import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kysely, Selectable } from 'kysely';
import { Executor, toJson } from '../../../database/database.factory';
import { InjectDatabase } from '../../../database/database.module';
import type {
  DB,
  OperationType,
  PaymentState,
  ProviderOperationsTable,
} from '../../../database/schema';
import { OutboxHandlerRegistry } from '../../../jobs/outbox/outbox-handler.registry';
import { OutboxService } from '../../../jobs/outbox/outbox.service';
import {
  DONE,
  HandlerResult,
  NonRetryableJobError,
  OutboxEvent,
} from '../../../jobs/outbox/outbox.types';
import { redact } from '../../../common/logging/redaction';
import { generatePublicReference } from '../../../shared/references/public-reference';
import { Clock } from '../../../shared/time/clock';
import { AuditService } from '../../audit/audit.service';
import { CardsService } from '../../cards/cards.service';
import { localMsisdnFromE164 } from '../../payees/domain/payee-identifier';
import type { ProviderCapability } from '../../provider/domain/capabilities';
import type {
  AuthorisationResult,
  OperationResult,
  PaymentProvider,
  PayoutResult,
} from '../../provider/domain/payment-provider';
import {
  CapabilityNotConfiguredError,
  ProviderRejectedError,
  ProviderUnreachableError,
} from '../../provider/domain/provider-errors';
import { ProviderGateway } from '../../provider/provider.gateway';
import { RiskService } from '../../risk/risk.service';
import { ReviewReason } from '../domain/payment-state-machine';
import { PaymentRow, PaymentTransitionsService } from './payment-transitions.service';
import { THREE_DS_RETURN_PREFIX } from './payment-view';
import { PAYMENT_JOBS } from './payments.service';

type Operation = Selectable<ProviderOperationsTable>;

/** PRD FR-EXE-05: no final answer within 2 minutes of authorisation → PENDING_REVIEW. */
export const REVIEW_AFTER_MS = 2 * 60_000;
/** 3-D Secure challenge window before the attempt is abandoned (OQ-22). */
export const AUTH_TIMEOUT_MS = 5 * 60_000;
/** Background reconciliation of a payment in review stops after this; operations take over. */
export const REVIEW_RECONCILE_MAX_MS = 24 * 3_600_000;
const NOT_SENT = 'NOT_SENT';

export const RISK_HOLD_APPROVED_EVENT = 'RISK_HOLD_APPROVED';

/** Review reasons the system keeps reconciling automatically against provider status. */
export const AUTO_RECONCILED_REVIEW_REASONS: ReviewReason[] = [
  'NO_FINAL_STATE_2MIN',
  'PAYOUT_OUTCOME_UNKNOWN',
  'CAPTURE_OUTCOME_UNKNOWN',
  'AUTH_OUTCOME_UNKNOWN',
];

function pollDelay(checks: number): number {
  return Math.min(10_000, 2_000 * 2 ** Math.min(checks, 3));
}

/**
 * Drives payments through the state machine (docs/payment-state-machine.md):
 *   authorise card → pay out to MoMo → confirm payout → capture card.
 * Rules that make this safe (brief §7, ADR 0003/0007):
 *   - intent is persisted (operation row + state) BEFORE any provider call, in a short transaction;
 *   - a call is re-sent only if the previous attempt provably never left (connection refused/DNS);
 *     otherwise status is queried, never re-sent;
 *   - the database permits at most one payout per payment;
 *   - provider calls never happen inside a database transaction.
 */
@Injectable()
export class PaymentOrchestrator implements OnModuleInit {
  private readonly logger = new Logger(PaymentOrchestrator.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly transitions: PaymentTransitionsService,
    private readonly outbox: OutboxService,
    private readonly registry: OutboxHandlerRegistry,
    private readonly gateway: ProviderGateway,
    private readonly cards: CardsService,
    private readonly risk: RiskService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    const handlers: [string, (event: OutboxEvent) => Promise<HandlerResult>][] = [
      [PAYMENT_JOBS.authorise, (event) => this.authorise(this.paymentId(event))],
      [PAYMENT_JOBS.pollAuthorisation, (event) => this.pollAuthorisation(this.paymentId(event))],
      [PAYMENT_JOBS.payout, (event) => this.payout(this.paymentId(event))],
      [PAYMENT_JOBS.pollPayout, (event) => this.pollPayout(this.paymentId(event))],
      [PAYMENT_JOBS.capture, (event) => this.capture(this.paymentId(event))],
      [PAYMENT_JOBS.pollCapture, (event) => this.pollCapture(this.paymentId(event))],
      [PAYMENT_JOBS.void, (event) => this.voidHold(this.paymentId(event))],
      [PAYMENT_JOBS.pollVoid, (event) => this.pollVoid(this.paymentId(event))],
      [PAYMENT_JOBS.reconcileReview, (event) => this.reconcileReview(this.paymentId(event), event)],
    ];
    for (const [type, handle] of handlers) {
      this.registry.register({ type, handle });
    }
  }

  // ------------------------------------------------------------------------------------------
  // Authorisation
  // ------------------------------------------------------------------------------------------

  async authorise(paymentId: string): Promise<HandlerResult> {
    const prepared = await this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      if (!payment) {
        return null;
      }
      if (payment.state === 'QUOTED') {
        const op = await this.createOperation(
          trx,
          payment,
          'AUTHORISATION',
          `${payment.reference}-AUTH`,
          payment.total_card_minor,
          payment.card_currency,
        );
        const moved = await this.transitions.transition(trx, payment, 'AUTH_PENDING', {
          source: 'WORKER',
        });
        return { payment: moved, op, send: true };
      }
      if (payment.state === 'AUTH_PENDING') {
        const op = await this.latestOperation(trx, paymentId, 'AUTHORISATION');
        if (op && op.status === 'REQUESTED' && op.failure_code === NOT_SENT) {
          return { payment, op, send: true };
        }
        await this.enqueue(trx, PAYMENT_JOBS.pollAuthorisation, paymentId, 2_000);
      }
      return null;
    });
    if (!prepared) {
      return DONE;
    }
    const { payment, op } = prepared;
    let result: AuthorisationResult;
    try {
      const cardToken = await this.cards.tokenFor(payment.card_id);
      result = await this.gateway.call('CARD_AUTHORISE', 'authorise', (provider) =>
        provider.authorise({
          requestRef: op.request_ref,
          cardToken,
          amountMinor: payment.total_card_minor,
          currency: payment.card_currency,
          requireThreeDs: payment.three_ds_required,
          returnUrl: `${THREE_DS_RETURN_PREFIX}?paymentId=${payment.id}`,
        }),
      );
    } catch (error) {
      return this.handleCallFailure(error, payment.id, op, {
        definiteFailure: async (trx, current, code) => {
          if (current.state === 'AUTH_PENDING') {
            await this.transitions.transition(trx, current, 'AUTH_FAILED', {
              source: 'WORKER',
              failureCode: code,
            });
          }
        },
        unknown: (trx) => this.enqueue(trx, PAYMENT_JOBS.pollAuthorisation, payment.id, 2_000),
      });
    }
    await this.applyAuthorisation(payment.id, result);
    return DONE;
  }

  private async applyAuthorisation(
    paymentId: string,
    result: AuthorisationResult,
  ): Promise<'final' | 'pending'> {
    return this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      const op = await this.latestOperation(trx, paymentId, 'AUTHORISATION');
      if (!payment || !op || payment.state !== 'AUTH_PENDING') {
        return 'final';
      }
      const now = this.clock.now();
      switch (result.status) {
        case 'AUTHORISED':
          await this.updateOperation(trx, op, {
            status: 'SUCCEEDED',
            provider_ref: result.providerRef,
            completed_at: now,
            raw: 'AUTHORISED',
          });
          await this.transitions.transition(trx, payment, 'AUTHORISED', {
            source: 'PROVIDER',
            set: { provider_auth_id: result.providerRef, next_action_url: null },
          });
          await this.enqueue(trx, PAYMENT_JOBS.payout, paymentId);
          return 'final';
        case 'REQUIRES_ACTION':
          await this.updateOperation(trx, op, {
            status: 'PENDING',
            provider_ref: result.providerRef,
            raw: 'REQUIRES_ACTION',
          });
          if (payment.next_action_url !== result.actionUrl) {
            await trx
              .updateTable('payments')
              .set({ next_action_url: result.actionUrl, three_ds_required: true })
              .where('id', '=', paymentId)
              .execute();
            await this.transitions.recordEvent(trx, paymentId, {
              type: 'THREE_DS_REQUIRED',
              source: 'PROVIDER',
            });
          }
          await this.enqueue(trx, PAYMENT_JOBS.pollAuthorisation, paymentId, 3_000);
          return 'pending';
        case 'PENDING':
          await this.updateOperation(trx, op, {
            status: 'PENDING',
            provider_ref: result.providerRef,
            raw: 'PENDING',
          });
          await this.enqueue(trx, PAYMENT_JOBS.pollAuthorisation, paymentId, 2_000);
          return 'pending';
        case 'DECLINED': {
          const failureCode =
            result.declineCode === 'THREE_DS_FAILED' ? 'THREE_DS_FAILED' : 'CARD_DECLINED';
          await this.updateOperation(trx, op, {
            status: 'FAILED',
            provider_ref: result.providerRef,
            completed_at: now,
            failure_code: result.declineCode,
            raw: 'DECLINED',
          });
          await this.transitions.transition(trx, payment, 'AUTH_FAILED', {
            source: 'PROVIDER',
            failureCode,
            set: { next_action_url: null },
          });
          return 'final';
        }
        case 'CANCELLED':
          await this.updateOperation(trx, op, {
            status: 'FAILED',
            provider_ref: result.providerRef,
            completed_at: now,
            failure_code: 'CANCELLED',
            raw: 'CANCELLED',
          });
          await this.transitions.transition(trx, payment, 'AUTH_FAILED', {
            source: 'PROVIDER',
            failureCode: 'THREE_DS_ABANDONED',
            set: { next_action_url: null },
          });
          return 'final';
        case 'NOT_FOUND':
          return 'pending';
      }
    });
  }

  async pollAuthorisation(paymentId: string): Promise<HandlerResult> {
    const payment = await this.load(paymentId);
    const op = await this.latestOperation(this.db, paymentId, 'AUTHORISATION');
    if (!payment || !op || payment.state !== 'AUTH_PENDING') {
      return DONE;
    }
    let result: AuthorisationResult | null = null;
    try {
      result = await this.gateway.call('CARD_AUTHORISE', 'authorisation_status', (provider) =>
        provider.getAuthorisation(op.request_ref),
      );
    } catch (error) {
      if (error instanceof CapabilityNotConfiguredError) {
        throw new NonRetryableJobError(error.message);
      }
      result = null;
    }
    if (result && ['AUTHORISED', 'DECLINED', 'CANCELLED'].includes(result.status)) {
      await this.applyAuthorisation(paymentId, result);
      return DONE;
    }
    const startedAt = payment.auth_pending_at ?? payment.created_at;
    if (this.clock.nowMs() - startedAt.getTime() > AUTH_TIMEOUT_MS) {
      // 3-D Secure abandoned or no answer: release anything that might be held (PRD §6: AUTH_FAILED).
      await this.db.transaction().execute(async (trx) => {
        const current = await this.transitions.lock(trx, paymentId);
        if (current?.state !== 'AUTH_PENDING') {
          return;
        }
        if (result?.status === 'NOT_FOUND' || !op.provider_ref) {
          await this.transitions.transition(trx, current, 'AUTH_FAILED', {
            source: 'WORKER',
            failureCode: 'THREE_DS_ABANDONED',
            set: { next_action_url: null },
          });
          return;
        }
        await this.transitions.transition(trx, current, 'VOID_PENDING', {
          source: 'WORKER',
          reason: 'AUTH_TIMEOUT',
          failureCode: 'THREE_DS_ABANDONED',
          set: { next_action_url: null },
        });
        await this.enqueue(trx, PAYMENT_JOBS.void, paymentId);
      });
      return DONE;
    }
    if (result) {
      await this.applyAuthorisation(paymentId, result);
    }
    return {
      outcome: 'reschedule',
      delayMs: op.status === 'PENDING' && payment.next_action_url ? 3_000 : 2_000,
    };
  }

  // ------------------------------------------------------------------------------------------
  // Payout
  // ------------------------------------------------------------------------------------------

  async payout(paymentId: string): Promise<HandlerResult> {
    const prepared = await this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      if (!payment) {
        return null;
      }
      if (payment.state === 'AUTHORISED') {
        if (!(await this.riskApproved(trx, paymentId))) {
          const hits = await this.risk.evaluatePayment(trx, {
            paymentId,
            userId: payment.user_id,
            cardId: payment.card_id,
            payeeId: payment.payee_id,
            deviceIdHash: payment.device_id_hash,
          });
          if (hits.length > 0) {
            // NFR-RSK-07: held with the card authorised, before any payout.
            await this.transitions.transition(trx, payment, 'PENDING_REVIEW', {
              source: 'SYSTEM',
              reviewReason: 'RISK_HOLD',
              payload: { rules: hits.map((hit) => hit.rule) },
            });
            this.logger.warn(
              { paymentId, rules: hits.map((hit) => hit.rule), alert: 'RISK_HOLD' },
              'Payment held for risk review',
            );
            return null;
          }
        }
        const op = await this.createOperation(
          trx,
          payment,
          'PAYOUT',
          `${payment.reference}-PAYOUT`,
          payment.amount_rwf,
          'RWF',
        );
        const moved = await this.transitions.transition(trx, payment, 'PAYOUT_PENDING', {
          source: 'WORKER',
        });
        return { payment: moved, op };
      }
      if (payment.state === 'PAYOUT_PENDING') {
        const op = await this.latestOperation(trx, paymentId, 'PAYOUT');
        if (op && op.status === 'REQUESTED' && op.failure_code === NOT_SENT) {
          return { payment, op };
        }
        // Possibly sent already: never re-send, only ask for status.
        await this.enqueue(trx, PAYMENT_JOBS.pollPayout, paymentId, 2_000);
      }
      return null;
    });
    if (!prepared) {
      return DONE;
    }
    const { payment, op } = prepared;
    const payee = await this.db
      .selectFrom('payees')
      .select(['identifier_type', 'identifier', 'network'])
      .where('id', '=', payment.payee_id)
      .executeTakeFirstOrThrow();
    let result: PayoutResult;
    try {
      result = await this.gateway.call(
        payee.identifier_type === 'PHONE' ? 'PAYOUT_MTN_PHONE' : 'PAYOUT_MTN_MERCHANT_CODE',
        'payout',
        (provider) =>
          provider.payout({
            requestRef: op.request_ref,
            payee: {
              network: payee.network,
              identifierType: payee.identifier_type,
              identifier: payee.identifier,
            },
            localMsisdn:
              payee.identifier_type === 'PHONE' ? localMsisdnFromE164(payee.identifier) : null,
            recipientName: payment.payee_name_snapshot,
            amountRwf: payment.amount_rwf,
          }),
      );
    } catch (error) {
      return this.handleCallFailure(error, payment.id, op, {
        definiteFailure: (trx, current, code) => this.failPayout(trx, current, code),
        unknown: (trx) => this.enqueue(trx, PAYMENT_JOBS.pollPayout, payment.id, 2_000),
      });
    }
    const outcome = await this.applyPayout(payment.id, result);
    if (outcome === 'pending') {
      await this.db
        .transaction()
        .execute((trx) => this.enqueue(trx, PAYMENT_JOBS.pollPayout, payment.id, 2_000));
    }
    return DONE;
  }

  /** Applies a payout status. Never initiates a payout. */
  private async applyPayout(paymentId: string, result: PayoutResult): Promise<'final' | 'pending'> {
    return this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      const op = await this.latestOperation(trx, paymentId, 'PAYOUT');
      if (!payment || !op) {
        return 'final';
      }
      const reconciling =
        payment.state === 'PENDING_REVIEW' &&
        AUTO_RECONCILED_REVIEW_REASONS.includes(payment.review_reason as ReviewReason);
      if (payment.state !== 'PAYOUT_PENDING' && !reconciling) {
        return 'final';
      }
      const now = this.clock.now();
      const providerRef = 'providerRef' in result ? result.providerRef : null;
      switch (result.status) {
        case 'SUCCEEDED':
          await this.updateOperation(trx, op, {
            status: 'SUCCEEDED',
            provider_ref: providerRef,
            completed_at: now,
            raw: result.raw,
          });
          await this.transitions.transition(trx, payment, 'CAPTURE_PENDING', {
            source: 'PROVIDER',
            set: { provider_payout_id: providerRef ?? op.request_ref },
          });
          await this.enqueue(trx, PAYMENT_JOBS.capture, paymentId);
          return 'final';
        case 'FAILED':
        case 'REVERSED':
          await this.updateOperation(trx, op, {
            status: result.status === 'FAILED' ? 'FAILED' : 'REVERSED',
            provider_ref: providerRef,
            completed_at: now,
            failure_code: result.status === 'FAILED' ? result.failureCode : 'REVERSED',
            raw: result.raw,
          });
          if (result.status === 'REVERSED') {
            await this.recordReversal(trx, payment, providerRef);
          }
          await this.failPayout(trx, payment, 'PAYOUT_FAILED');
          return 'final';
        case 'PENDING':
        case 'UNKNOWN':
          await this.updateOperation(trx, op, {
            status: op.status === 'UNKNOWN' || result.status === 'UNKNOWN' ? 'UNKNOWN' : 'PENDING',
            provider_ref: providerRef,
            raw: result.raw,
            checked: true,
          });
          return 'pending';
        case 'NOT_FOUND':
          // Ambiguous (OQ-19): never treated as "safe to re-send".
          await this.updateOperation(trx, op, { checked: true });
          return 'pending';
      }
    });
  }

  async pollPayout(paymentId: string): Promise<HandlerResult> {
    const payment = await this.load(paymentId);
    const op = await this.latestOperation(this.db, paymentId, 'PAYOUT');
    if (!payment || !op || payment.state !== 'PAYOUT_PENDING') {
      return DONE;
    }
    const result = await this.safeStatus('PAYOUT_STATUS', 'payout_status', (provider) =>
      provider.getPayoutStatus(op.request_ref),
    );
    if (result && (await this.applyPayout(paymentId, result)) === 'final') {
      return DONE;
    }
    if (this.overdue(payment.authorised_at)) {
      await this.moveToReview(
        paymentId,
        'PAYOUT_PENDING',
        op.status === 'UNKNOWN' ? 'PAYOUT_OUTCOME_UNKNOWN' : 'NO_FINAL_STATE_2MIN',
      );
      return DONE;
    }
    return { outcome: 'reschedule', delayMs: pollDelay(op.check_count) };
  }

  private async failPayout(trx: Executor, payment: PaymentRow, failureCode: string): Promise<void> {
    let current = payment;
    if (current.state === 'PAYOUT_PENDING') {
      current = await this.transitions.transition(trx, current, 'PAYOUT_FAILED', {
        source: 'PROVIDER',
        failureCode,
      });
    }
    if (current.state === 'PAYOUT_FAILED' || current.state === 'PENDING_REVIEW') {
      // FR-EXE-03: release the card hold automatically.
      await this.transitions.transition(trx, current, 'VOID_PENDING', {
        source: 'WORKER',
        failureCode,
      });
      await this.enqueue(trx, PAYMENT_JOBS.void, payment.id);
    }
  }

  private async recordReversal(
    trx: Executor,
    payment: PaymentRow,
    providerRef: string | null,
  ): Promise<void> {
    await trx
      .insertInto('payment_adjustments')
      .values({
        reference: generatePublicReference('RF'),
        payment_id: payment.id,
        type: 'PAYOUT_REVERSAL',
        status: 'RECORDED',
        amount_minor: payment.amount_rwf,
        currency: 'RWF',
        reason: 'Provider reported the payout as reversed',
        requested_by_type: 'PROVIDER',
        provider_ref: providerRef,
      })
      .execute();
    this.logger.error(
      { paymentId: payment.id, alert: 'PAYOUT_REVERSED' },
      'Payout reversed by provider',
    );
  }

  // ------------------------------------------------------------------------------------------
  // Capture
  // ------------------------------------------------------------------------------------------

  async capture(paymentId: string): Promise<HandlerResult> {
    const prepared = await this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      if (!payment || payment.state !== 'CAPTURE_PENDING') {
        return null;
      }
      const live = await this.liveOperation(trx, paymentId, 'CAPTURE');
      if (live) {
        if (live.status === 'REQUESTED' && live.failure_code === NOT_SENT) {
          return { payment, op: live };
        }
        await this.enqueue(trx, PAYMENT_JOBS.pollCapture, paymentId, 2_000);
        return null;
      }
      const attempts = await this.countOperations(trx, paymentId, 'CAPTURE');
      const op = await this.createOperation(
        trx,
        payment,
        'CAPTURE',
        `${payment.reference}-CAP${attempts + 1}`,
        payment.total_card_minor,
        payment.card_currency,
      );
      return { payment, op };
    });
    if (!prepared) {
      return DONE;
    }
    const { payment, op } = prepared;
    let result: OperationResult;
    try {
      result = await this.gateway.call('CARD_CAPTURE', 'capture', (provider) =>
        provider.capture({
          requestRef: op.request_ref,
          providerAuthRef: payment.provider_auth_id ?? '',
          amountMinor: payment.total_card_minor,
          currency: payment.card_currency,
        }),
      );
    } catch (error) {
      return this.handleCallFailure(error, payment.id, op, {
        definiteFailure: (trx, current, code) => this.captureFailed(trx, current, code),
        unknown: (trx) => this.enqueue(trx, PAYMENT_JOBS.pollCapture, payment.id, 2_000),
      });
    }
    if ((await this.applyCapture(payment.id, op.id, result)) === 'pending') {
      await this.db
        .transaction()
        .execute((trx) => this.enqueue(trx, PAYMENT_JOBS.pollCapture, payment.id, 2_000));
    }
    return DONE;
  }

  private async applyCapture(
    paymentId: string,
    operationId: string,
    result: OperationResult,
  ): Promise<'final' | 'pending'> {
    return this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      const op = await trx
        .selectFrom('provider_operations')
        .selectAll()
        .where('id', '=', operationId)
        .executeTakeFirst();
      const reconciling =
        payment?.state === 'PENDING_REVIEW' && payment.review_reason === 'CAPTURE_OUTCOME_UNKNOWN';
      if (!payment || !op || (payment.state !== 'CAPTURE_PENDING' && !reconciling)) {
        return 'final';
      }
      const now = this.clock.now();
      switch (result.status) {
        case 'SUCCEEDED':
          await this.updateOperation(trx, op, {
            status: 'SUCCEEDED',
            provider_ref: result.providerRef,
            completed_at: now,
            raw: 'SUCCEEDED',
          });
          await this.transitions.transition(trx, payment, 'COMPLETED', {
            source: 'PROVIDER',
            set: { provider_capture_id: result.providerRef },
          });
          await this.afterCompletion(trx, payment);
          return 'final';
        case 'FAILED':
          await this.updateOperation(trx, op, {
            status: 'FAILED',
            provider_ref: result.providerRef,
            completed_at: now,
            failure_code: result.failureCode,
            raw: 'FAILED',
          });
          if (reconciling) {
            await this.transitions.recordEvent(trx, paymentId, {
              type: 'CAPTURE_FAILED_CONFIRMED',
              source: 'PROVIDER',
              reason: result.failureCode,
            });
          } else {
            await this.captureFailed(trx, payment, result.failureCode);
          }
          return 'final';
        case 'PENDING':
          await this.updateOperation(trx, op, {
            status: 'PENDING',
            provider_ref: result.providerRef,
            raw: 'PENDING',
            checked: true,
          });
          return 'pending';
        case 'NOT_FOUND':
          await this.updateOperation(trx, op, { checked: true });
          return 'pending';
      }
    });
  }

  async pollCapture(paymentId: string): Promise<HandlerResult> {
    const payment = await this.load(paymentId);
    const op = await this.liveOperation(this.db, paymentId, 'CAPTURE');
    if (!payment || !op || payment.state !== 'CAPTURE_PENDING') {
      return DONE;
    }
    const result = await this.safeStatus('CARD_CAPTURE', 'capture_status', (provider) =>
      provider.getCapture(op.request_ref),
    );
    if (result && (await this.applyCapture(paymentId, op.id, result)) === 'final') {
      return DONE;
    }
    if (this.overdue(payment.payout_confirmed_at)) {
      await this.moveToReview(paymentId, 'CAPTURE_PENDING', 'CAPTURE_OUTCOME_UNKNOWN');
      return DONE;
    }
    return { outcome: 'reschedule', delayMs: pollDelay(op.check_count) };
  }

  /** The merchant has been paid but the card was not captured: ops must act. Never pay out again. */
  private async captureFailed(
    trx: Executor,
    payment: PaymentRow,
    failureCode: string,
  ): Promise<void> {
    if (payment.state !== 'CAPTURE_PENDING') {
      return;
    }
    await this.transitions.transition(trx, payment, 'CAPTURE_FAILED', {
      source: 'PROVIDER',
      failureCode,
    });
    await this.audit.record(
      {
        actor: { type: 'SYSTEM' },
        action: 'payment.capture_failed',
        entityType: 'payment',
        entityId: payment.id,
        metadata: { failureCode },
      },
      trx,
    );
    this.logger.error(
      { paymentId: payment.id, failureCode, alert: 'CAPTURE_FAILED' },
      'Card capture failed after a confirmed payout',
    );
  }

  private async afterCompletion(trx: Executor, payment: PaymentRow): Promise<void> {
    const now = this.clock.now();
    await trx
      .updateTable('cards')
      .set({ first_payment_at: now })
      .where('id', '=', payment.card_id)
      .where('first_payment_at', 'is', null)
      .execute();
    await trx
      .updateTable('payees')
      .set({ first_paid_at: now })
      .where('id', '=', payment.payee_id)
      .where('first_paid_at', 'is', null)
      .execute();
    await this.completionHook?.(trx, payment);
  }

  /** Set by the notifications module so completion triggers receipts and messages (Phase 5). */
  completionHook?: (trx: Executor, payment: PaymentRow) => Promise<void>;

  // ------------------------------------------------------------------------------------------
  // Void (release the hold)
  // ------------------------------------------------------------------------------------------

  async voidHold(paymentId: string): Promise<HandlerResult> {
    const prepared = await this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      if (!payment || payment.state !== 'VOID_PENDING') {
        return null;
      }
      const auth = await this.latestOperation(trx, paymentId, 'AUTHORISATION');
      if (!auth?.provider_ref) {
        // Nothing was ever held at the provider.
        await this.transitions.transition(trx, payment, 'AUTH_FAILED', { source: 'WORKER' });
        return null;
      }
      const live = await this.liveOperation(trx, paymentId, 'VOID');
      if (live) {
        if (live.status === 'REQUESTED' && live.failure_code === NOT_SENT) {
          return { payment, op: live, authRef: auth.provider_ref };
        }
        await this.enqueue(trx, PAYMENT_JOBS.pollVoid, paymentId, 2_000);
        return null;
      }
      const attempts = await this.countOperations(trx, paymentId, 'VOID');
      const op = await this.createOperation(
        trx,
        payment,
        'VOID',
        `${payment.reference}-VOID${attempts + 1}`,
        payment.total_card_minor,
        payment.card_currency,
      );
      return { payment, op, authRef: auth.provider_ref };
    });
    if (!prepared) {
      return DONE;
    }
    const { payment, op, authRef } = prepared;
    let result: OperationResult;
    try {
      result = await this.gateway.call('CARD_VOID', 'void', (provider) =>
        provider.void({
          requestRef: op.request_ref,
          providerAuthRef: authRef,
          amountMinor: payment.total_card_minor,
          currency: payment.card_currency,
        }),
      );
    } catch (error) {
      return this.handleCallFailure(error, payment.id, op, {
        definiteFailure: (trx, current, code) => this.voidFailed(trx, current, code),
        unknown: (trx) => this.enqueue(trx, PAYMENT_JOBS.pollVoid, payment.id, 2_000),
      });
    }
    if ((await this.applyVoid(payment.id, op.id, result)) === 'pending') {
      await this.db
        .transaction()
        .execute((trx) => this.enqueue(trx, PAYMENT_JOBS.pollVoid, payment.id, 2_000));
    }
    return DONE;
  }

  private async applyVoid(
    paymentId: string,
    operationId: string,
    result: OperationResult,
  ): Promise<'final' | 'pending'> {
    return this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      const op = await trx
        .selectFrom('provider_operations')
        .selectAll()
        .where('id', '=', operationId)
        .executeTakeFirst();
      if (!payment || !op || payment.state !== 'VOID_PENDING') {
        return 'final';
      }
      const now = this.clock.now();
      switch (result.status) {
        case 'SUCCEEDED': {
          await this.updateOperation(trx, op, {
            status: 'SUCCEEDED',
            provider_ref: result.providerRef,
            completed_at: now,
            raw: 'SUCCEEDED',
          });
          const auth = await this.latestOperation(trx, paymentId, 'AUTHORISATION');
          await this.transitions.transition(
            trx,
            payment,
            auth?.status === 'SUCCEEDED' ? 'VOIDED' : 'AUTH_FAILED',
            { source: 'PROVIDER' },
          );
          await this.recordVoidAdjustment(trx, payment, result.providerRef, op.id);
          return 'final';
        }
        case 'FAILED':
          await this.updateOperation(trx, op, {
            status: 'FAILED',
            provider_ref: result.providerRef,
            completed_at: now,
            failure_code: result.failureCode,
            raw: 'FAILED',
          });
          await this.voidFailed(trx, payment, result.failureCode);
          return 'final';
        case 'PENDING':
          await this.updateOperation(trx, op, {
            status: 'PENDING',
            provider_ref: result.providerRef,
            raw: 'PENDING',
            checked: true,
          });
          return 'pending';
        case 'NOT_FOUND':
          await this.updateOperation(trx, op, { checked: true });
          return 'pending';
      }
    });
  }

  async pollVoid(paymentId: string): Promise<HandlerResult> {
    const payment = await this.load(paymentId);
    const op = await this.liveOperation(this.db, paymentId, 'VOID');
    if (!payment || !op || payment.state !== 'VOID_PENDING') {
      return DONE;
    }
    const result = await this.safeStatus('CARD_VOID', 'void_status', (provider) =>
      provider.getVoid(op.request_ref),
    );
    if (result && (await this.applyVoid(paymentId, op.id, result)) === 'final') {
      return DONE;
    }
    if (this.overdue(payment.state_changed_at)) {
      await this.db.transaction().execute(async (trx) => {
        const current = await this.transitions.lock(trx, paymentId);
        if (current?.state === 'VOID_PENDING') {
          await this.voidFailed(trx, current, 'VOID_OUTCOME_UNKNOWN');
        }
      });
      return DONE;
    }
    return { outcome: 'reschedule', delayMs: pollDelay(op.check_count) };
  }

  private async voidFailed(trx: Executor, payment: PaymentRow, failureCode: string): Promise<void> {
    if (payment.state !== 'VOID_PENDING') {
      return;
    }
    await this.transitions.transition(trx, payment, 'PENDING_REVIEW', {
      source: 'WORKER',
      reviewReason: 'VOID_FAILED',
      reason: failureCode,
    });
    this.logger.error(
      { paymentId: payment.id, failureCode, alert: 'VOID_FAILED' },
      'Card hold could not be released',
    );
  }

  private async recordVoidAdjustment(
    trx: Executor,
    payment: PaymentRow,
    providerRef: string,
    operationId: string,
  ): Promise<void> {
    await trx
      .insertInto('payment_adjustments')
      .values({
        reference: generatePublicReference('RF'),
        payment_id: payment.id,
        type: 'VOID',
        status: 'SUCCEEDED',
        amount_minor: payment.total_card_minor,
        currency: payment.card_currency,
        reason: payment.failure_code ?? 'HOLD_RELEASED',
        requested_by_type: 'SYSTEM',
        operation_id: operationId,
        provider_ref: providerRef,
        completed_at: this.clock.now(),
      })
      .execute();
  }

  // ------------------------------------------------------------------------------------------
  // Review: keep reconciling until an authoritative answer arrives (then advance automatically)
  // ------------------------------------------------------------------------------------------

  async reconcileReview(paymentId: string, event: OutboxEvent): Promise<HandlerResult> {
    const payment = await this.load(paymentId);
    if (
      !payment ||
      payment.state !== 'PENDING_REVIEW' ||
      !AUTO_RECONCILED_REVIEW_REASONS.includes(payment.review_reason as ReviewReason)
    ) {
      return DONE;
    }
    if (
      payment.review_at &&
      this.clock.nowMs() - payment.review_at.getTime() > REVIEW_RECONCILE_MAX_MS
    ) {
      this.logger.error(
        { paymentId, alert: 'REVIEW_UNRESOLVED_24H' },
        'Payment still unresolved after 24 hours of reconciliation',
      );
      return DONE;
    }
    if (payment.review_reason === 'CAPTURE_OUTCOME_UNKNOWN') {
      const op = await this.liveOperation(this.db, paymentId, 'CAPTURE');
      const result = op
        ? await this.safeStatus('CARD_CAPTURE', 'capture_status', (provider) =>
            provider.getCapture(op.request_ref),
          )
        : null;
      if (op && result && (await this.applyCapture(paymentId, op.id, result)) === 'final') {
        return DONE;
      }
    } else {
      const op = await this.latestOperation(this.db, paymentId, 'PAYOUT');
      const result = op
        ? await this.safeStatus('PAYOUT_STATUS', 'payout_status', (provider) =>
            provider.getPayoutStatus(op.request_ref),
          )
        : null;
      if (op && result && (await this.applyPayout(paymentId, result)) === 'final') {
        return DONE;
      }
    }
    const previous = Number((event.payload as { delayMs?: number }).delayMs ?? 30_000);
    const delayMs = Math.min(15 * 60_000, previous * 2);
    return { outcome: 'reschedule', delayMs, payload: { paymentId, delayMs } };
  }

  private async moveToReview(
    paymentId: string,
    expected: PaymentState,
    reason: ReviewReason,
  ): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const current = await this.transitions.lock(trx, paymentId);
      if (current?.state !== expected) {
        return;
      }
      await this.transitions.transition(trx, current, 'PENDING_REVIEW', {
        source: 'WORKER',
        reviewReason: reason,
      });
      await this.outbox.enqueue(trx, {
        type: PAYMENT_JOBS.reconcileReview,
        aggregateType: 'payment',
        aggregateId: paymentId,
        payload: { paymentId, delayMs: 30_000 },
        availableAt: this.clock.plusMs(30_000),
        dedupeKey: `payment:${paymentId}:${PAYMENT_JOBS.reconcileReview}`,
      });
    });
    this.logger.warn(
      { paymentId, reason, alert: 'PENDING_REVIEW' },
      'Payment moved to review: no final answer in 2 minutes',
    );
  }

  // ------------------------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------------------------

  /**
   * Classifies a failed provider call. "Never sent" is retried by the outbox (same request
   * reference); "outcome unknown" switches to status polling; definite failures end the step.
   */
  private async handleCallFailure(
    error: unknown,
    paymentId: string,
    op: Operation,
    handlers: {
      definiteFailure: (trx: Executor, current: PaymentRow, code: string) => Promise<void>;
      unknown: (trx: Executor) => Promise<void>;
    },
  ): Promise<HandlerResult> {
    if (error instanceof ProviderUnreachableError) {
      await this.db
        .updateTable('provider_operations')
        .set({ failure_code: NOT_SENT })
        .where('id', '=', op.id)
        .execute();
      throw error;
    }
    const definite =
      error instanceof ProviderRejectedError || error instanceof CapabilityNotConfiguredError;
    const code =
      error instanceof CapabilityNotConfiguredError
        ? 'CAPABILITY_NOT_CONFIGURED'
        : error instanceof ProviderRejectedError
          ? 'PROVIDER_REJECTED'
          : 'OUTCOME_UNKNOWN';
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('provider_operations')
        .set({
          status: definite ? 'FAILED' : 'UNKNOWN',
          failure_code: code,
          ...(definite ? { completed_at: this.clock.now() } : {}),
          response_redacted: toJson(
            redact({ error: error instanceof Error ? error.message : String(error) }),
          ),
        })
        .where('id', '=', op.id)
        .execute();
      const current = await this.transitions.lock(trx, paymentId);
      if (!current) {
        return;
      }
      if (definite) {
        await handlers.definiteFailure(trx, current, code);
      } else {
        // ProviderOutcomeUnknownError or anything unexpected: the call may have been processed.
        await handlers.unknown(trx);
      }
    });
    return DONE;
  }

  private async safeStatus<T>(
    capability: ProviderCapability,
    name: string,
    fn: (provider: PaymentProvider) => Promise<T>,
  ): Promise<T | null> {
    try {
      return await this.gateway.call(capability, name, fn);
    } catch (error) {
      if (error instanceof CapabilityNotConfiguredError) {
        throw new NonRetryableJobError(error.message);
      }
      return null;
    }
  }

  private overdue(since: Date | null): boolean {
    return since !== null && this.clock.nowMs() - since.getTime() > REVIEW_AFTER_MS;
  }

  private async riskApproved(trx: Executor, paymentId: string): Promise<boolean> {
    const approval = await trx
      .selectFrom('payment_events')
      .select('id')
      .where('payment_id', '=', paymentId)
      .where('event_type', '=', RISK_HOLD_APPROVED_EVENT)
      .executeTakeFirst();
    return approval !== undefined;
  }

  private paymentId(event: OutboxEvent): string {
    const id = (event.payload as { paymentId?: unknown }).paymentId;
    if (typeof id !== 'string') {
      throw new NonRetryableJobError('Missing paymentId');
    }
    return id;
  }

  private async load(paymentId: string): Promise<PaymentRow | undefined> {
    return this.db
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', paymentId)
      .executeTakeFirst();
  }

  async enqueue(
    trx: Executor,
    type: string,
    paymentId: string,
    delayMs = 0,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await this.outbox.enqueue(trx, {
      type,
      aggregateType: 'payment',
      aggregateId: paymentId,
      payload: { paymentId, ...payload },
      availableAt: this.clock.plusMs(delayMs),
      dedupeKey: `payment:${paymentId}:${type}`,
    });
  }

  private async createOperation(
    trx: Executor,
    payment: PaymentRow,
    type: OperationType,
    requestRef: string,
    amountMinor: bigint,
    currency: string,
  ): Promise<Operation> {
    return trx
      .insertInto('provider_operations')
      .values({
        payment_id: payment.id,
        type,
        request_ref: requestRef,
        status: 'REQUESTED',
        amount_minor: amountMinor,
        currency,
        requested_at: this.clock.now(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  private async latestOperation(
    executor: Executor,
    paymentId: string,
    type: OperationType,
  ): Promise<Operation | undefined> {
    return executor
      .selectFrom('provider_operations')
      .selectAll()
      .where('payment_id', '=', paymentId)
      .where('type', '=', type)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
  }

  private async liveOperation(
    executor: Executor,
    paymentId: string,
    type: OperationType,
  ): Promise<Operation | undefined> {
    return executor
      .selectFrom('provider_operations')
      .selectAll()
      .where('payment_id', '=', paymentId)
      .where('type', '=', type)
      .where('status', '!=', 'FAILED')
      .orderBy('created_at', 'desc')
      .executeTakeFirst();
  }

  private async countOperations(
    executor: Executor,
    paymentId: string,
    type: OperationType,
  ): Promise<number> {
    const rows = await executor
      .selectFrom('provider_operations')
      .select('id')
      .where('payment_id', '=', paymentId)
      .where('type', '=', type)
      .execute();
    return rows.length;
  }

  private async updateOperation(
    trx: Executor,
    op: Operation,
    update: {
      status?: Operation['status'];
      provider_ref?: string | null;
      completed_at?: Date;
      failure_code?: string | null;
      raw?: string;
      checked?: boolean;
    },
  ): Promise<void> {
    await trx
      .updateTable('provider_operations')
      .set({
        ...(update.status ? { status: update.status } : {}),
        ...(update.provider_ref ? { provider_ref: update.provider_ref } : {}),
        ...(update.completed_at ? { completed_at: update.completed_at } : {}),
        ...(update.failure_code !== undefined ? { failure_code: update.failure_code } : {}),
        ...(update.raw ? { provider_status_raw: update.raw.slice(0, 40) } : {}),
        ...(update.checked
          ? { last_checked_at: this.clock.now(), check_count: op.check_count + 1 }
          : {}),
      })
      .where('id', '=', op.id)
      .execute();
  }
}
