import { Kysely } from 'kysely';
import type { DB } from '../../src/database/schema';
import { OutboxHandlerRegistry } from '../../src/jobs/outbox/outbox-handler.registry';
import { OutboxDispatcher } from '../../src/jobs/outbox/outbox.dispatcher';
import { OutboxService } from '../../src/jobs/outbox/outbox.service';
import { DONE, NonRetryableJobError, OutboxEvent } from '../../src/jobs/outbox/outbox.types';
import { MetricsService } from '../../src/modules/health/metrics.service';
import { ManualClock } from '../../src/shared/time/clock';
import { openTestDatabase, resetDatabase } from '../support/test-database';

describe('transactional outbox (PostgreSQL)', () => {
  let db: Kysely<DB>;
  let clock: ManualClock;
  let outbox: OutboxService;
  let registry: OutboxHandlerRegistry;
  let dispatcher: OutboxDispatcher;

  beforeAll(() => {
    db = openTestDatabase();
  });

  afterAll(async () => {
    await db.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(db);
    // Database time (now()) and the manual clock must agree for claim queries.
    clock = new ManualClock(new Date());
    outbox = new OutboxService(db, clock);
    registry = new OutboxHandlerRegistry();
    dispatcher = new OutboxDispatcher(outbox, registry, new MetricsService());
  });

  const job = (overrides: Partial<Parameters<OutboxService['enqueue']>[1]> = {}) => ({
    type: 'test.job',
    aggregateType: 'test',
    aggregateId: 'agg-1',
    payload: { value: 1 },
    ...overrides,
  });

  async function rows(): Promise<OutboxEvent[]> {
    return db.selectFrom('outbox_events').selectAll().orderBy('created_at').execute();
  }

  it('does not keep a job whose enqueueing transaction rolled back', async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        await outbox.enqueue(trx, job());
        throw new Error('state change failed');
      }),
    ).rejects.toThrow('state change failed');
    expect(await rows()).toHaveLength(0);
  });

  it('keeps at most one live job per dedupe key', async () => {
    await outbox.enqueue(db, job({ dedupeKey: 'poll:payment-1' }));
    await outbox.enqueue(db, job({ dedupeKey: 'poll:payment-1' }));
    expect(await rows()).toHaveLength(1);

    registry.register({ type: 'test.job', handle: () => Promise.resolve(DONE) });
    await dispatcher.runOnce();
    await outbox.enqueue(db, job({ dedupeKey: 'poll:payment-1' }));
    const all = await rows();
    expect(all.map((row) => row.status)).toEqual(['DONE', 'PENDING']);
  });

  it('does not claim jobs before they are due', async () => {
    await outbox.enqueue(db, job({ availableAt: clock.plusMs(60_000) }));
    expect(await outbox.claimBatch('w1', 10, 60_000)).toHaveLength(0);
    clock.advance(61_000);
    expect(await outbox.claimBatch('w1', 10, 60_000)).toHaveLength(1);
  });

  it('never hands the same job to two concurrent workers', async () => {
    for (let index = 0; index < 30; index += 1) {
      await outbox.enqueue(db, job({ aggregateId: `agg-${index}` }));
    }
    const [first, second, third] = await Promise.all([
      outbox.claimBatch('w1', 15, 60_000),
      outbox.claimBatch('w2', 15, 60_000),
      outbox.claimBatch('w3', 15, 60_000),
    ]);
    const ids = [...(first ?? []), ...(second ?? []), ...(third ?? [])].map((event) => event.id);
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(30);
  });

  it('reclaims a job after its lease expires and ignores the stale worker', async () => {
    await outbox.enqueue(db, job());
    const [claimed] = await outbox.claimBatch('crashed-worker', 1, 60_000);
    expect(claimed?.attempts).toBe(1);

    expect(await outbox.claimBatch('w2', 1, 60_000)).toHaveLength(0);
    clock.advance(61_000);
    const [reclaimed] = await outbox.claimBatch('w2', 1, 60_000);
    expect(reclaimed?.id).toBe(claimed?.id);
    expect(reclaimed?.attempts).toBe(2);

    // The crashed worker wakes up late: its completion must not override the new owner.
    await outbox.markDone(claimed as OutboxEvent, 'crashed-worker');
    expect((await rows())[0]?.status).toBe('PROCESSING');
    await outbox.markDone(reclaimed as OutboxEvent, 'w2');
    expect((await rows())[0]?.status).toBe('DONE');
  });

  it('marks successful jobs done', async () => {
    const seen: unknown[] = [];
    registry.register({
      type: 'test.job',
      handle: (event) => {
        seen.push(event.payload);
        return Promise.resolve(DONE);
      },
    });
    await outbox.enqueue(db, job());
    const summary = await dispatcher.runOnce();
    expect(summary).toMatchObject({ claimed: 1, done: 1 });
    expect(seen).toEqual([{ value: 1 }]);
    const [row] = await rows();
    expect(row?.status).toBe('DONE');
    expect(row?.processed_at).not.toBeNull();
  });

  it('reschedules polling jobs without counting failures', async () => {
    registry.register({
      type: 'test.job',
      handle: () =>
        Promise.resolve({ outcome: 'reschedule', delayMs: 5_000, payload: { polls: 2 } }),
    });
    await outbox.enqueue(db, job());
    await dispatcher.runOnce();
    const [row] = await rows();
    expect(row?.status).toBe('PENDING');
    expect(row?.attempts).toBe(0);
    expect(row?.payload).toEqual({ polls: 2 });
    expect(row?.available_at.getTime()).toBeGreaterThanOrEqual(clock.nowMs() + 5_000 - 5);
  });

  it('retries failures with backoff, then dead-letters after max attempts', async () => {
    registry.register({
      type: 'test.job',
      handle: () => Promise.reject(new Error('provider timeout')),
    });
    await outbox.enqueue(db, job({ maxAttempts: 3 }));

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      clock.advance(10 * 60_000);
      const summary = await dispatcher.runOnce();
      expect(summary.claimed).toBe(1);
    }
    const [row] = await rows();
    expect(row?.status).toBe('DEAD');
    expect(row?.attempts).toBe(3);
    expect(row?.last_error).toContain('provider timeout');
  });

  it('dead-letters non-retryable errors and jobs without a handler immediately', async () => {
    registry.register({
      type: 'test.job',
      handle: () => Promise.reject(new NonRetryableJobError('bad payload')),
    });
    await outbox.enqueue(db, job());
    await outbox.enqueue(db, job({ type: 'unknown.job' }));
    const summary = await dispatcher.runOnce();
    expect(summary.dead).toBe(2);
    expect((await rows()).every((row) => row.status === 'DEAD')).toBe(true);
  });

  it('reports queue depth by status', async () => {
    await outbox.enqueue(db, job());
    await outbox.enqueue(db, job({ aggregateId: 'agg-2' }));
    expect(await outbox.countByStatus()).toEqual({ PENDING: 2 });
  });
});
