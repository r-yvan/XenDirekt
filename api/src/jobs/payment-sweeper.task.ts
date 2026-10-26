import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectDatabase } from '../database/database.module';
import type { DB, PaymentState } from '../database/schema';
import { MetricsService } from '../modules/health/metrics.service';
import {
  AUTO_RECONCILED_REVIEW_REASONS,
  PaymentOrchestrator,
  REVIEW_RECONCILE_MAX_MS,
} from '../modules/payments/application/payment-orchestrator';
import { PAYMENT_JOBS } from '../modules/payments/application/payments.service';
import { Clock } from '../shared/time/clock';
import { OutboxService } from './outbox/outbox.service';
import { PeriodicTaskRegistry } from './periodic-task.registry';

/** Which job keeps a payment in each in-flight state moving. */
const DRIVER_JOB: Partial<Record<PaymentState, string>> = {
  QUOTED: PAYMENT_JOBS.authorise,
  AUTH_PENDING: PAYMENT_JOBS.pollAuthorisation,
  AUTHORISED: PAYMENT_JOBS.payout,
  PAYOUT_PENDING: PAYMENT_JOBS.pollPayout,
  CAPTURE_PENDING: PAYMENT_JOBS.capture,
  VOID_PENDING: PAYMENT_JOBS.void,
};

const NON_FINAL: PaymentState[] = [
  'QUOTED',
  'AUTH_PENDING',
  'AUTHORISED',
  'PAYOUT_PENDING',
  'PAYOUT_FAILED',
  'VOID_PENDING',
  'CAPTURE_PENDING',
  'CAPTURE_FAILED',
  'PENDING_REVIEW',
];

/**
 * Safety net, every 30 s: re-enqueues the driving job for any in-flight payment (dedupe keys make
 * this a no-op when a job is already live), and publishes stuck-payment gauges for alerting.
 * It never calls the provider itself.
 */
@Injectable()
export class PaymentSweeperTask implements OnModuleInit {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly registry: PeriodicTaskRegistry,
    private readonly orchestrator: PaymentOrchestrator,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      name: 'payment-sweeper',
      intervalMs: 30_000,
      lockKey: 7_301,
      run: async () => {
        await this.run();
      },
    });
  }

  async run(): Promise<{ requeued: number }> {
    const stale = new Date(this.clock.nowMs() - 30_000);
    const rows = await this.db
      .selectFrom('payments')
      .select(['id', 'state', 'review_reason', 'review_at'])
      .where('state', 'in', NON_FINAL)
      .where('state_changed_at', '<', stale)
      .limit(500)
      .execute();
    let requeued = 0;
    for (const row of rows) {
      let job = DRIVER_JOB[row.state];
      if (
        row.state === 'PENDING_REVIEW' &&
        AUTO_RECONCILED_REVIEW_REASONS.includes(row.review_reason as never) &&
        row.review_at &&
        this.clock.nowMs() - row.review_at.getTime() < REVIEW_RECONCILE_MAX_MS
      ) {
        job = PAYMENT_JOBS.reconcileReview;
      }
      if (job) {
        await this.orchestrator.enqueue(
          this.db,
          job,
          row.id,
          0,
          job === PAYMENT_JOBS.reconcileReview ? { delayMs: 30_000 } : {},
        );
        requeued += 1;
      }
    }
    await this.publishMetrics();
    return { requeued };
  }

  private async publishMetrics(): Promise<void> {
    const states = await this.db
      .selectFrom('payments')
      .select([
        'state',
        sql<string>`count(*)`.as('count'),
        sql<Date>`min(state_changed_at)`.as('oldest'),
      ])
      .where('state', 'in', NON_FINAL)
      .groupBy('state')
      .execute();
    this.metrics.paymentsByState.reset();
    this.metrics.oldestPaymentAge.reset();
    for (const row of states) {
      this.metrics.paymentsByState.set({ state: row.state }, Number(row.count));
      this.metrics.oldestPaymentAge.set(
        { state: row.state },
        Math.max(0, (this.clock.nowMs() - new Date(row.oldest).getTime()) / 1000),
      );
    }
    const depth = await this.outbox.countByStatus();
    for (const status of ['PENDING', 'PROCESSING', 'DEAD']) {
      this.metrics.outboxDepth.set({ status }, depth[status] ?? 0);
    }
  }
}
