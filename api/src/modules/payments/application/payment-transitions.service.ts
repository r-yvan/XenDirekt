import { Injectable } from '@nestjs/common';
import { Selectable, Updateable } from 'kysely';
import { RequestContext } from '../../../common/context/request-context';
import { redact } from '../../../common/logging/redaction';
import { Executor, toJson } from '../../../database/database.factory';
import type { EventSource, PaymentsTable, PaymentState } from '../../../database/schema';
import { Clock } from '../../../shared/time/clock';
import { MetricsService } from '../../health/metrics.service';
import { assertTransition, ReviewReason, STATE_TIMESTAMP } from '../domain/payment-state-machine';

export type PaymentRow = Selectable<PaymentsTable>;

/** Runs inside the transition's transaction (notifications, analytics). Must not call providers. */
export type TransitionListener = (
  trx: Executor,
  payment: PaymentRow,
  from: PaymentState,
) => Promise<void>;

export interface TransitionOptions {
  source: EventSource;
  reason?: string;
  reviewReason?: ReviewReason;
  failureCode?: string | null;
  actorId?: string | null;
  /** Extra columns set in the same update (provider refs, next action, …). */
  set?: Updateable<PaymentsTable>;
  payload?: unknown;
}

/**
 * The only code that changes `payments.state`. Must run inside a transaction that already holds
 * the row lock (see `lock`). Validates the edge, bumps the optimistic version, stamps the state
 * timestamp and appends to the immutable payment_events timeline in the same transaction.
 */
@Injectable()
export class PaymentTransitionsService {
  private readonly listeners: TransitionListener[] = [];

  constructor(
    private readonly clock: Clock,
    private readonly metrics: MetricsService,
  ) {}

  onTransition(listener: TransitionListener): void {
    this.listeners.push(listener);
  }

  async lock(trx: Executor, paymentId: string): Promise<PaymentRow | undefined> {
    return trx
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', paymentId)
      .forUpdate()
      .executeTakeFirst();
  }

  async transition(
    trx: Executor,
    payment: PaymentRow,
    to: PaymentState,
    options: TransitionOptions,
  ): Promise<PaymentRow> {
    assertTransition(payment.state, to);
    const now = this.clock.now();
    const timestampColumn = STATE_TIMESTAMP[to];
    const updated = await trx
      .updateTable('payments')
      .set({
        ...options.set,
        state: to,
        state_changed_at: now,
        version: payment.version + 1,
        ...(timestampColumn ? { [timestampColumn]: now } : {}),
        ...(to === 'PENDING_REVIEW'
          ? { review_reason: options.reviewReason ?? 'NO_FINAL_STATE_2MIN' }
          : {}),
        ...(payment.state === 'PENDING_REVIEW' && to !== 'PENDING_REVIEW'
          ? { review_reason: null }
          : {}),
        ...(options.failureCode !== undefined ? { failure_code: options.failureCode } : {}),
      })
      .where('id', '=', payment.id)
      .where('version', '=', payment.version)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      // Only possible if the caller did not hold the row lock.
      throw new Error(`Concurrent modification of payment ${payment.id}`);
    }
    await this.recordEvent(trx, payment.id, {
      from: payment.state,
      to,
      type: 'STATE_CHANGED',
      source: options.source,
      reason: options.reason ?? options.reviewReason ?? options.failureCode ?? null,
      actorId: options.actorId ?? null,
      payload: options.payload,
    });
    this.metrics.paymentTransitions.inc({ from: payment.state, to });
    for (const listener of this.listeners) {
      await listener(trx, updated, payment.state);
    }
    return updated;
  }

  async recordEvent(
    trx: Executor,
    paymentId: string,
    event: {
      from?: PaymentState | null;
      to?: PaymentState | null;
      type: string;
      source: EventSource;
      reason?: string | null;
      actorId?: string | null;
      payload?: unknown;
    },
  ): Promise<void> {
    await trx
      .insertInto('payment_events')
      .values({
        payment_id: paymentId,
        from_state: event.from ?? null,
        to_state: event.to ?? null,
        event_type: event.type,
        source: event.source,
        actor_id: event.actorId ?? null,
        reason: event.reason ?? null,
        payload_redacted: event.payload === undefined ? null : toJson(redact(event.payload)),
        correlation_id: RequestContext.correlationId() ?? null,
      })
      .execute();
  }
}
