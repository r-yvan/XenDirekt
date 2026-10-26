import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RequestContext } from '../../common/context/request-context';
import { MetricsService } from '../../modules/health/metrics.service';
import { OutboxHandlerRegistry } from './outbox-handler.registry';
import { OutboxService } from './outbox.service';
import { NonRetryableJobError, OutboxEvent } from './outbox.types';

export interface DispatchSummary {
  claimed: number;
  done: number;
  rescheduled: number;
  retried: number;
  dead: number;
}

/**
 * Claims due outbox jobs and runs their handlers. Delivery is at least once; handlers are
 * idempotent. The lease must outlast the slowest handler (provider timeout plus database work).
 */
@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);
  readonly workerId = `worker-${randomUUID()}`;
  static readonly LEASE_MS = 60_000;

  constructor(
    private readonly outbox: OutboxService,
    private readonly registry: OutboxHandlerRegistry,
    private readonly metrics: MetricsService,
  ) {}

  /** Processes one batch. Tests call this directly to drive the system deterministically. */
  async runOnce(batchSize = 20): Promise<DispatchSummary> {
    const events = await this.outbox.claimBatch(
      this.workerId,
      batchSize,
      OutboxDispatcher.LEASE_MS,
    );
    const summary: DispatchSummary = {
      claimed: events.length,
      done: 0,
      rescheduled: 0,
      retried: 0,
      dead: 0,
    };
    for (const event of events) {
      const outcome = await RequestContext.run(
        {
          correlationId: event.correlation_id ?? randomUUID(),
          actor: { type: 'WORKER', id: this.workerId },
        },
        () => this.process(event),
      );
      summary[outcome] += 1;
    }
    return summary;
  }

  /** Runs batches until nothing is due (bounded), used by tests and inline mode. */
  async drain(maxBatches = 50): Promise<DispatchSummary> {
    const total: DispatchSummary = { claimed: 0, done: 0, rescheduled: 0, retried: 0, dead: 0 };
    for (let batch = 0; batch < maxBatches; batch += 1) {
      const summary = await this.runOnce();
      for (const key of Object.keys(total) as (keyof DispatchSummary)[]) {
        total[key] += summary[key];
      }
      if (summary.claimed === 0) {
        break;
      }
    }
    return total;
  }

  private async process(event: OutboxEvent): Promise<'done' | 'rescheduled' | 'retried' | 'dead'> {
    const handler = this.registry.get(event.type);
    if (!handler) {
      await this.outbox.markFailed(
        event,
        this.workerId,
        `No handler registered for ${event.type}`,
        false,
      );
      this.metrics.outboxJobs.inc({ type: event.type, outcome: 'dead' });
      this.logger.error({ jobType: event.type, jobId: event.id }, 'Outbox job has no handler');
      return 'dead';
    }
    try {
      const result = await handler.handle(event);
      if (result.outcome === 'reschedule') {
        await this.outbox.reschedule(event, this.workerId, result.delayMs, result.payload);
        this.metrics.outboxJobs.inc({ type: event.type, outcome: 'rescheduled' });
        return 'rescheduled';
      }
      await this.outbox.markDone(event, this.workerId);
      this.metrics.outboxJobs.inc({ type: event.type, outcome: 'done' });
      return 'done';
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const retryable = !(error instanceof NonRetryableJobError);
      const outcome = await this.outbox.markFailed(event, this.workerId, message, retryable);
      this.metrics.outboxJobs.inc({
        type: event.type,
        outcome: outcome === 'dead' ? 'dead' : 'retry',
      });
      this.logger.warn(
        { jobType: event.type, jobId: event.id, attempts: event.attempts, outcome, err: error },
        'Outbox job failed',
      );
      return outcome === 'dead' ? 'dead' : 'retried';
    }
  }
}
