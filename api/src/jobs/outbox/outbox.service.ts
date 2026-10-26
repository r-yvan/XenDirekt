import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { RequestContext } from '../../common/context/request-context';
import { Executor, toJson } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { backoffDelayMs } from './backoff';
import { EnqueueOptions, OutboxEvent } from './outbox.types';

/**
 * Transactional outbox (ADR 0003). `enqueue` must be called with the same transaction that
 * commits the state change, so a committed change can never lose its follow-up job.
 */
@Injectable()
export class OutboxService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
  ) {}

  async enqueue(executor: Executor, options: EnqueueOptions): Promise<void> {
    const values = {
      type: options.type,
      aggregate_type: options.aggregateType,
      aggregate_id: options.aggregateId,
      payload: toJson(options.payload ?? {}),
      available_at: options.availableAt ?? this.clock.now(),
      dedupe_key: options.dedupeKey ?? null,
      max_attempts: options.maxAttempts ?? 10,
      correlation_id: RequestContext.correlationId() ?? null,
    };
    if (options.dedupeKey) {
      await sql`
        INSERT INTO outbox_events
          (type, aggregate_type, aggregate_id, payload, available_at, dedupe_key, max_attempts, correlation_id)
        VALUES
          (${values.type}, ${values.aggregate_type}, ${values.aggregate_id}, ${values.payload}::jsonb,
           ${values.available_at}, ${values.dedupe_key}, ${values.max_attempts}, ${values.correlation_id})
        ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('PENDING', 'PROCESSING')
        DO NOTHING
      `.execute(executor);
      return;
    }
    await executor.insertInto('outbox_events').values(values).execute();
  }

  /**
   * Claims up to `limit` due jobs (or jobs whose lease expired after a crash) and marks them
   * PROCESSING under this worker's lease. SKIP LOCKED lets several workers claim concurrently
   * without blocking or double-claiming.
   */
  async claimBatch(workerId: string, limit: number, leaseMs: number): Promise<OutboxEvent[]> {
    const now = this.clock.now();
    const leaseUntil = new Date(now.getTime() + leaseMs);
    const result = await sql<OutboxEvent>`
      WITH due AS (
        SELECT id FROM outbox_events
        WHERE (status = 'PENDING' AND available_at <= ${now})
           OR (status = 'PROCESSING' AND locked_until < ${now})
        ORDER BY available_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE outbox_events AS o
      SET status = 'PROCESSING', attempts = o.attempts + 1, locked_until = ${leaseUntil}, locked_by = ${workerId}
      FROM due
      WHERE o.id = due.id
      RETURNING o.*
    `.execute(this.db);
    return result.rows;
  }

  async markDone(event: OutboxEvent, workerId: string): Promise<void> {
    await this.db
      .updateTable('outbox_events')
      .set({ status: 'DONE', processed_at: this.clock.now(), locked_until: null, last_error: null })
      .where('id', '=', event.id)
      .where('locked_by', '=', workerId)
      .execute();
  }

  async reschedule(
    event: OutboxEvent,
    workerId: string,
    delayMs: number,
    payload?: Record<string, unknown>,
  ): Promise<void> {
    await this.db
      .updateTable('outbox_events')
      .set({
        status: 'PENDING',
        attempts: 0,
        available_at: this.clock.plusMs(delayMs),
        locked_until: null,
        last_error: null,
        ...(payload ? { payload: toJson(payload) } : {}),
      })
      .where('id', '=', event.id)
      .where('locked_by', '=', workerId)
      .execute();
  }

  /** Failure: retry with backoff, or DEAD once attempts are exhausted (or the error is final). */
  async markFailed(
    event: OutboxEvent,
    workerId: string,
    error: string,
    retryable: boolean,
  ): Promise<'retry' | 'dead'> {
    const exhausted = !retryable || event.attempts >= event.max_attempts;
    await this.db
      .updateTable('outbox_events')
      .set(
        exhausted
          ? { status: 'DEAD', locked_until: null, last_error: error.slice(0, 1000) }
          : {
              status: 'PENDING',
              locked_until: null,
              last_error: error.slice(0, 1000),
              available_at: this.clock.plusMs(backoffDelayMs(event.attempts)),
            },
      )
      .where('id', '=', event.id)
      .where('locked_by', '=', workerId)
      .execute();
    return exhausted ? 'dead' : 'retry';
  }

  async countByStatus(): Promise<Record<string, number>> {
    const rows = await this.db
      .selectFrom('outbox_events')
      .select(['status', sql<string>`count(*)`.as('count')])
      .where('status', 'in', ['PENDING', 'PROCESSING', 'DEAD'])
      .groupBy('status')
      .execute();
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }
}
