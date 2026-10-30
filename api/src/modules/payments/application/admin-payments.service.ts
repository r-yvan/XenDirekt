import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { type AuthenticatedAdmin } from '../../../common/decorators/auth.decorators';
import { AppError } from '../../../common/errors/app-error';
import { maskEmail, maskName, maskPhone } from '../../../common/logging/masking';
import { InjectDatabase } from '../../../database/database.module';
import type { DB, PaymentState } from '../../../database/schema';
import { parseRwandaMsisdn } from '../../../shared/phone/phone';
import { Clock } from '../../../shared/time/clock';
import { roleHasPermission } from '../../admin/permissions';
import { AuditService } from '../../audit/audit.service';
import {
  AUTO_RECONCILED_REVIEW_REASONS,
  PaymentOrchestrator,
  RISK_HOLD_APPROVED_EVENT,
} from './payment-orchestrator';
import { PaymentTransitionsService } from './payment-transitions.service';
import { paymentView } from './payment-view';
import { PAYMENT_JOBS } from './payments.service';
import type { ReviewReason } from '../domain/payment-state-machine';

export const REVIEW_ACTIONS = [
  'APPROVE_RISK_HOLD',
  'REJECT_AND_RELEASE',
  'CONFIRM_PAYOUT_SUCCEEDED',
  'CONFIRM_PAYOUT_FAILED',
  'RETRY_CAPTURE',
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export interface PaymentSearch {
  reference?: string;
  email?: string;
  phone?: string;
  momo?: string;
  last4?: string;
  state?: PaymentState;
  from?: Date;
  to?: Date;
  limit?: number;
}

/**
 * Operations back end for payments (FR-ADM-02/03/07). Personal data is masked unless the role
 * may see it (NFR-SEC-05). Every review action is validated against the payment's financial
 * position (its provider operations), not only its state, and is audited.
 */
@Injectable()
export class AdminPaymentsService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly transitions: PaymentTransitionsService,
    private readonly orchestrator: PaymentOrchestrator,
    private readonly audit: AuditService,
  ) {}

  async search(admin: AuthenticatedAdmin, filter: PaymentSearch) {
    let query = this.db
      .selectFrom('payments')
      .innerJoin('users', 'users.id', 'payments.user_id')
      .innerJoin('payees', 'payees.id', 'payments.payee_id')
      .selectAll('payments')
      .select([
        'users.full_name',
        'users.email',
        'users.phone_e164',
        'payees.identifier as payee_identifier',
      ])
      .orderBy('payments.created_at', 'desc')
      .limit(Math.min(filter.limit ?? 50, 200));
    if (filter.reference) {
      query = query.where((eb) =>
        eb.or([
          eb('payments.reference', '=', filter.reference!.toUpperCase()),
          eb('payments.provider_payout_id', '=', filter.reference!),
          eb('payments.provider_auth_id', '=', filter.reference!),
        ]),
      );
    }
    if (filter.email) {
      query = query.where('users.email', '=', filter.email.toLowerCase());
    }
    if (filter.phone) {
      query = query.where('users.phone_e164', '=', filter.phone.replace(/[^\d+]/g, ''));
    }
    if (filter.momo) {
      const msisdn = parseRwandaMsisdn(filter.momo);
      query = query.where('payees.identifier', '=', msisdn?.e164 ?? filter.momo);
    }
    if (filter.last4) {
      query = query.where('payments.card_last4_snapshot', '=', filter.last4);
    }
    if (filter.state) {
      query = query.where('payments.state', '=', filter.state);
    }
    if (filter.from) {
      query = query.where('payments.created_at', '>=', filter.from);
    }
    if (filter.to) {
      query = query.where('payments.created_at', '<', filter.to);
    }
    const unmasked = roleHasPermission(admin.role, 'personal-data:unmasked');
    const rows = await query.execute();
    return {
      payments: rows.map((row) => ({
        ...paymentView(row),
        reviewReason: row.review_reason,
        customer: {
          userId: row.user_id,
          name: unmasked ? row.full_name : maskName(row.full_name),
          email: unmasked ? row.email : maskEmail(row.email),
          phone: unmasked ? row.phone_e164 : maskPhone(row.phone_e164),
        },
        payeeIdentifier: unmasked ? row.payee_identifier : maskPhone(row.payee_identifier),
      })),
    };
  }

  /** Full timeline: state changes, provider calls, adjustments, risk flags, tickets. */
  async detail(admin: AuthenticatedAdmin, paymentId: string) {
    const row = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', paymentId)
      .executeTakeFirst();
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    const [events, operations, adjustments, flags, tickets] = await Promise.all([
      this.db
        .selectFrom('payment_events')
        .selectAll()
        .where('payment_id', '=', paymentId)
        .orderBy('created_at')
        .execute(),
      this.db
        .selectFrom('provider_operations')
        .selectAll()
        .where('payment_id', '=', paymentId)
        .orderBy('created_at')
        .execute(),
      this.db
        .selectFrom('payment_adjustments')
        .selectAll()
        .where('payment_id', '=', paymentId)
        .orderBy('created_at')
        .execute(),
      this.db
        .selectFrom('risk_flags')
        .selectAll()
        .where('payment_id', '=', paymentId)
        .orderBy('created_at')
        .execute(),
      this.db
        .selectFrom('tickets')
        .select(['id', 'reference', 'category', 'status', 'created_at'])
        .where('payment_id', '=', paymentId)
        .execute(),
    ]);
    const customer =
      (await this.search(admin, { reference: row.reference, limit: 1 })).payments[0]?.customer ??
      null;
    return {
      payment: {
        ...paymentView(row),
        reviewReason: row.review_reason,
        provider: row.provider,
        customer,
      },
      timeline: events.map((event) => ({
        at: event.created_at.toISOString(),
        type: event.event_type,
        from: event.from_state,
        to: event.to_state,
        source: event.source,
        actorId: event.actor_id,
        reason: event.reason,
        payload: event.payload_redacted,
      })),
      operations: operations.map((op) => ({
        id: op.id,
        type: op.type,
        requestRef: op.request_ref,
        providerRef: op.provider_ref,
        status: op.status,
        providerStatus: op.provider_status_raw,
        failureCode: op.failure_code,
        amountMinor: Number(op.amount_minor),
        currency: op.currency,
        requestedAt: op.requested_at.toISOString(),
        completedAt: op.completed_at?.toISOString() ?? null,
        checks: op.check_count,
      })),
      adjustments: adjustments.map((adjustment) => ({
        id: adjustment.id,
        reference: adjustment.reference,
        type: adjustment.type,
        status: adjustment.status,
        amountMinor: Number(adjustment.amount_minor),
        currency: adjustment.currency,
        reason: adjustment.reason,
        requestedBy: adjustment.requested_by,
        approvedBy: adjustment.approved_by,
        createdAt: adjustment.created_at.toISOString(),
      })),
      riskFlags: flags.map((flag) => ({
        id: flag.id,
        rule: flag.rule,
        severity: flag.severity,
        status: flag.status,
        evidence: flag.evidence,
      })),
      tickets: tickets.map((ticket) => ({
        ...ticket,
        created_at: ticket.created_at.toISOString(),
      })),
    };
  }

  /** FR-ADM-03: everything waiting for a human, oldest first. */
  async reviewQueue() {
    const rows = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('state', 'in', ['PENDING_REVIEW', 'CAPTURE_FAILED'])
      .orderBy('state_changed_at', 'asc')
      .limit(200)
      .execute();
    const now = this.clock.nowMs();
    return {
      items: rows.map((row) => ({
        id: row.id,
        reference: row.reference,
        state: row.state,
        reviewReason: row.state === 'CAPTURE_FAILED' ? 'CAPTURE_FAILED' : row.review_reason,
        amountRwf: Number(row.amount_rwf),
        waitingSeconds: Math.round((now - row.state_changed_at.getTime()) / 1000),
        autoReconciling:
          row.state === 'PENDING_REVIEW' &&
          AUTO_RECONCILED_REVIEW_REASONS.includes(row.review_reason as ReviewReason),
      })),
    };
  }

  async act(admin: AuthenticatedAdmin, paymentId: string, action: ReviewAction, reason: string) {
    const outcome = await this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      if (!payment) {
        throw new AppError('NOT_FOUND');
      }
      const ops = await trx
        .selectFrom('provider_operations')
        .selectAll()
        .where('payment_id', '=', paymentId)
        .execute();
      const auth = ops.find((op) => op.type === 'AUTHORISATION');
      const payout = ops.find((op) => op.type === 'PAYOUT');
      const options = { source: 'OPS' as const, actorId: admin.adminId, reason };
      const conflict = (message: string) =>
        new AppError('PAYMENT_STATE_CONFLICT', message, { state: payment.state, action });

      switch (action) {
        case 'APPROVE_RISK_HOLD': {
          if (
            payment.state !== 'PENDING_REVIEW' ||
            payment.review_reason !== 'RISK_HOLD' ||
            auth?.status !== 'SUCCEEDED' ||
            payout
          ) {
            throw conflict(
              'Only a risk-held, authorised payment without a payout can be approved.',
            );
          }
          await this.transitions.recordEvent(trx, paymentId, {
            type: RISK_HOLD_APPROVED_EVENT,
            source: 'OPS',
            actorId: admin.adminId,
            reason,
          });
          await this.transitions.transition(trx, payment, 'AUTHORISED', options);
          await this.orchestrator.enqueue(trx, PAYMENT_JOBS.payout, paymentId);
          break;
        }
        case 'REJECT_AND_RELEASE': {
          // Only while no money can have left: no payout at all, or a payout that definitively failed.
          if (
            payment.state !== 'PENDING_REVIEW' ||
            (payout && payout.status !== 'FAILED' && payout.status !== 'REVERSED')
          ) {
            throw conflict(
              'A payout may have reached the seller; the hold cannot simply be released.',
            );
          }
          await this.transitions.transition(trx, payment, 'VOID_PENDING', {
            ...options,
            failureCode: 'RISK_REJECTED',
          });
          await this.orchestrator.enqueue(trx, PAYMENT_JOBS.void, paymentId);
          break;
        }
        case 'CONFIRM_PAYOUT_SUCCEEDED': {
          if (
            payment.state !== 'PENDING_REVIEW' ||
            !payout ||
            payout.status === 'FAILED' ||
            payout.status === 'REVERSED'
          ) {
            throw conflict('There is no open payout to confirm.');
          }
          await trx
            .updateTable('provider_operations')
            .set({
              status: 'SUCCEEDED',
              completed_at: this.clock.now(),
              provider_status_raw: 'OPS_CONFIRMED',
            })
            .where('id', '=', payout.id)
            .execute();
          await this.transitions.transition(trx, payment, 'CAPTURE_PENDING', options);
          await this.orchestrator.enqueue(trx, PAYMENT_JOBS.capture, paymentId);
          break;
        }
        case 'CONFIRM_PAYOUT_FAILED': {
          if (payment.state !== 'PENDING_REVIEW' || !payout || payout.status === 'SUCCEEDED') {
            throw conflict('A payout that succeeded cannot be marked as failed.');
          }
          await trx
            .updateTable('provider_operations')
            .set({
              status: 'FAILED',
              completed_at: this.clock.now(),
              failure_code: 'OPS_CONFIRMED_FAILED',
            })
            .where('id', '=', payout.id)
            .execute();
          await this.transitions.transition(trx, payment, 'VOID_PENDING', {
            ...options,
            failureCode: 'PAYOUT_FAILED',
          });
          await this.orchestrator.enqueue(trx, PAYMENT_JOBS.void, paymentId);
          break;
        }
        case 'RETRY_CAPTURE': {
          const lastCapture = ops.filter((op) => op.type === 'CAPTURE').at(-1);
          const allowed =
            payout?.status === 'SUCCEEDED' &&
            (payment.state === 'CAPTURE_FAILED' ||
              (payment.state === 'PENDING_REVIEW' && lastCapture?.status === 'FAILED'));
          if (!allowed) {
            throw conflict(
              'Capture can only be retried after a confirmed payout and a failed capture.',
            );
          }
          await this.transitions.transition(trx, payment, 'CAPTURE_PENDING', options);
          await this.orchestrator.enqueue(trx, PAYMENT_JOBS.capture, paymentId);
          break;
        }
      }
      await this.audit.record(
        {
          action: `payment.review.${action.toLowerCase()}`,
          entityType: 'payment',
          entityId: paymentId,
          before: { state: payment.state, reviewReason: payment.review_reason },
          metadata: { reason },
        },
        trx,
      );
      return trx
        .selectFrom('payments')
        .selectAll()
        .where('id', '=', paymentId)
        .executeTakeFirstOrThrow();
    });
    return paymentView(outcome);
  }

  /** FR-ADM-07 dashboard figures for a period. */
  async metrics(from: Date, to: Date) {
    const totals = await this.db
      .selectFrom('payments')
      .select([
        sql<string>`count(*)`.as('created'),
        sql<string>`count(*) FILTER (WHERE state IN ('COMPLETED', 'REFUNDED'))`.as('completed'),
        sql<string>`coalesce(sum(amount_rwf) FILTER (WHERE state IN ('COMPLETED', 'REFUNDED')), 0)`.as(
          'volume_rwf',
        ),
        sql<string>`count(*) FILTER (WHERE state = 'PENDING_REVIEW')`.as('in_review'),
        sql<
          number | null
        >`percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM completed_at - created_at)) FILTER (WHERE completed_at IS NOT NULL)`.as(
          'median_time_to_pay_s',
        ),
        sql<
          number | null
        >`percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM payout_confirmed_at - authorised_at)) FILTER (WHERE payout_confirmed_at IS NOT NULL)`.as(
          'p95_settlement_s',
        ),
      ])
      .where('created_at', '>=', from)
      .where('created_at', '<', to)
      .executeTakeFirstOrThrow();
    const failures = await this.db
      .selectFrom('payments')
      .select(['failure_code', sql<string>`count(*)`.as('count')])
      .where('created_at', '>=', from)
      .where('created_at', '<', to)
      .where('state', 'in', ['AUTH_FAILED', 'VOIDED'])
      .groupBy('failure_code')
      .execute();
    const created = Number(totals.created);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      payments: created,
      completed: Number(totals.completed),
      completionRate: created === 0 ? null : Number(totals.completed) / created,
      volumeRwf: Number(totals.volume_rwf),
      inReview: Number(totals.in_review),
      medianTimeToPaySeconds:
        totals.median_time_to_pay_s === null
          ? null
          : Math.round(Number(totals.median_time_to_pay_s)),
      p95SettlementSeconds:
        totals.p95_settlement_s === null ? null : Math.round(Number(totals.p95_settlement_s)),
      failuresByReason: Object.fromEntries(
        failures.map((row) => [row.failure_code ?? 'UNKNOWN', Number(row.count)]),
      ),
    };
  }
}
