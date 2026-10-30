import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kysely } from 'kysely';
import { type AuthenticatedAdmin } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { redact } from '../../common/logging/redaction';
import { Executor, toJson } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { OutboxHandlerRegistry } from '../../jobs/outbox/outbox-handler.registry';
import { OutboxService } from '../../jobs/outbox/outbox.service';
import { DONE, NonRetryableJobError } from '../../jobs/outbox/outbox.types';
import { generatePublicReference } from '../../shared/references/public-reference';
import { Clock } from '../../shared/time/clock';
import { AuditService } from '../audit/audit.service';
import { PaymentTransitionsService } from '../payments/application/payment-transitions.service';
import {
  ProviderOutcomeUnknownError,
  ProviderUnreachableError,
} from '../provider/domain/provider-errors';
import { ProviderGateway } from '../provider/provider.gateway';

const EXECUTE_JOB = 'refund.execute';

/**
 * Refunds of captured card charges (FR-ADM-03, PRD REFUNDED). Distinct from voids (releasing a
 * hold before capture) and payout reversals (reported by the provider); each is its own
 * adjustment record. Maker-checker: the approver must differ from the requester (enforced here
 * and by a database CHECK). Execution needs the CARD_REFUND capability; without it the approved
 * refund waits for manual handling and nothing is faked (docs/refunds-and-reconciliation.md).
 */
@Injectable()
export class RefundsService implements OnModuleInit {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly gateway: ProviderGateway,
    private readonly outbox: OutboxService,
    private readonly registry: OutboxHandlerRegistry,
    private readonly transitions: PaymentTransitionsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      type: EXECUTE_JOB,
      handle: (event) =>
        this.execute(String((event.payload as { adjustmentId?: string }).adjustmentId)),
    });
  }

  async request(
    admin: AuthenticatedAdmin,
    paymentId: string,
    reason: string,
    idempotencyKey: string,
  ) {
    const existing = await this.db
      .selectFrom('payment_adjustments')
      .selectAll()
      .where('idempotency_key', '=', idempotencyKey)
      .executeTakeFirst();
    if (existing) {
      if (existing.payment_id !== paymentId) {
        throw new AppError('IDEMPOTENCY_KEY_REUSED');
      }
      return this.view(existing);
    }
    return this.db.transaction().execute(async (trx) => {
      const payment = await this.transitions.lock(trx, paymentId);
      if (!payment) {
        throw new AppError('NOT_FOUND');
      }
      if (payment.state !== 'COMPLETED') {
        // Before capture the right tool is a void, which the orchestrator does automatically.
        throw new AppError(
          'REFUND_NOT_ALLOWED',
          'Only completed (captured) payments can be refunded.',
          { state: payment.state },
        );
      }
      const live = await trx
        .selectFrom('payment_adjustments')
        .select('id')
        .where('payment_id', '=', paymentId)
        .where('type', '=', 'REFUND')
        .where('status', 'not in', ['FAILED', 'REJECTED'])
        .executeTakeFirst();
      if (live) {
        throw new AppError('REFUND_NOT_ALLOWED', 'A refund for this payment already exists.');
      }
      const row = await trx
        .insertInto('payment_adjustments')
        .values({
          reference: generatePublicReference('RF'),
          payment_id: paymentId,
          type: 'REFUND',
          status: 'REQUESTED',
          amount_minor: payment.total_card_minor,
          currency: payment.card_currency,
          reason,
          requested_by_type: 'ADMIN',
          requested_by: admin.adminId,
          idempotency_key: idempotencyKey,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await this.transitions.recordEvent(trx, paymentId, {
        type: 'REFUND_REQUESTED',
        source: 'OPS',
        actorId: admin.adminId,
        reason,
      });
      await this.audit.record(
        {
          action: 'refund.requested',
          entityType: 'payment_adjustment',
          entityId: row.id,
          metadata: { paymentId, reason },
        },
        trx,
      );
      return this.view(row);
    });
  }

  async approve(admin: AuthenticatedAdmin, adjustmentId: string) {
    return this.db.transaction().execute(async (trx) => {
      const adjustment = await trx
        .selectFrom('payment_adjustments')
        .selectAll()
        .where('id', '=', adjustmentId)
        .forUpdate()
        .executeTakeFirst();
      if (!adjustment || adjustment.type !== 'REFUND') {
        throw new AppError('NOT_FOUND');
      }
      if (adjustment.status !== 'REQUESTED') {
        throw new AppError('CONFLICT', 'Only a requested refund can be approved.');
      }
      if (adjustment.requested_by === admin.adminId) {
        throw new AppError('MAKER_CHECKER_VIOLATION');
      }
      const usable = this.gateway.isUsable('CARD_REFUND');
      const updated = await trx
        .updateTable('payment_adjustments')
        .set({
          status: usable ? 'APPROVED' : 'AWAITING_CAPABILITY',
          approved_by: admin.adminId,
          approved_at: this.clock.now(),
        })
        .where('id', '=', adjustmentId)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (usable) {
        await this.outbox.enqueue(trx, {
          type: EXECUTE_JOB,
          aggregateType: 'payment_adjustment',
          aggregateId: adjustmentId,
          payload: { adjustmentId },
          dedupeKey: `refund:${adjustmentId}`,
        });
      } else {
        this.logger.warn(
          { adjustmentId, alert: 'REFUND_NEEDS_MANUAL_HANDLING' },
          'Refund approved but provider refund capability is not configured',
        );
      }
      await this.audit.record(
        {
          action: 'refund.approved',
          entityType: 'payment_adjustment',
          entityId: adjustmentId,
          after: { status: updated.status },
        },
        trx,
      );
      return this.view(updated);
    });
  }

  async reject(admin: AuthenticatedAdmin, adjustmentId: string, note: string) {
    const current = await this.db
      .selectFrom('payment_adjustments')
      .select('requested_by')
      .where('id', '=', adjustmentId)
      .executeTakeFirst();
    if (current?.requested_by === admin.adminId) {
      throw new AppError('MAKER_CHECKER_VIOLATION');
    }
    const updated = await this.db
      .updateTable('payment_adjustments')
      .set({ status: 'REJECTED', approved_by: admin.adminId, approved_at: this.clock.now() })
      .where('id', '=', adjustmentId)
      .where('type', '=', 'REFUND')
      .where('status', '=', 'REQUESTED')
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      throw new AppError('CONFLICT', 'Only a requested refund can be rejected.');
    }
    await this.audit.record({
      action: 'refund.rejected',
      entityType: 'payment_adjustment',
      entityId: adjustmentId,
      metadata: { note },
    });
    return this.view(updated);
  }

  /**
   * Operations completed the refund outside XenDirekt (partner portal) because no refund API is
   * available: record it with the partner's reference as evidence.
   */
  async recordManual(
    admin: AuthenticatedAdmin,
    adjustmentId: string,
    providerReference: string,
    note: string,
  ) {
    return this.db.transaction().execute(async (trx) => {
      const adjustment = await trx
        .selectFrom('payment_adjustments')
        .selectAll()
        .where('id', '=', adjustmentId)
        .forUpdate()
        .executeTakeFirst();
      if (!adjustment || adjustment.status !== 'AWAITING_CAPABILITY') {
        throw new AppError(
          'CONFLICT',
          'Only an approved refund awaiting manual handling can be recorded.',
        );
      }
      await this.complete(
        trx,
        adjustment.payment_id,
        adjustmentId,
        providerReference,
        admin.adminId,
        'OPS',
      );
      await this.audit.record(
        {
          action: 'refund.recorded_manually',
          entityType: 'payment_adjustment',
          entityId: adjustmentId,
          metadata: { providerReference, note },
        },
        trx,
      );
      return this.view(
        await trx
          .selectFrom('payment_adjustments')
          .selectAll()
          .where('id', '=', adjustmentId)
          .executeTakeFirstOrThrow(),
      );
    });
  }

  async list(status?: string) {
    let query = this.db
      .selectFrom('payment_adjustments')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(200);
    if (status) {
      query = query.where('status', '=', status as never);
    }
    return { adjustments: (await query.execute()).map((row) => this.view(row)) };
  }

  private async execute(adjustmentId: string) {
    const adjustment = await this.db
      .selectFrom('payment_adjustments')
      .selectAll()
      .where('id', '=', adjustmentId)
      .executeTakeFirst();
    if (!adjustment) {
      throw new NonRetryableJobError('Unknown refund');
    }
    if (adjustment.status !== 'APPROVED' && adjustment.status !== 'SUBMITTED') {
      return DONE;
    }
    const payment = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', adjustment.payment_id)
      .executeTakeFirstOrThrow();
    const requestRef = `${payment.reference}-${adjustment.reference}`;
    if (adjustment.status === 'SUBMITTED') {
      // Possibly sent already: never re-send a refund; operations reconcile it (OQ-12).
      this.logger.error(
        { adjustmentId, alert: 'REFUND_OUTCOME_UNKNOWN' },
        'Refund outcome unknown; needs reconciliation',
      );
      return DONE;
    }
    await this.db
      .updateTable('payment_adjustments')
      .set({ status: 'SUBMITTED' })
      .where('id', '=', adjustmentId)
      .execute();
    try {
      const result = await this.gateway.call('CARD_REFUND', 'refund', (provider) =>
        provider.refund({
          requestRef,
          providerAuthRef: payment.provider_capture_id ?? payment.provider_auth_id ?? '',
          amountMinor: adjustment.amount_minor,
          currency: adjustment.currency,
        }),
      );
      await this.db.transaction().execute(async (trx) => {
        if (result.status === 'SUCCEEDED') {
          await this.complete(
            trx,
            payment.id,
            adjustmentId,
            result.providerRef,
            adjustment.approved_by,
            'PROVIDER',
          );
        } else if (result.status === 'FAILED') {
          await trx
            .updateTable('payment_adjustments')
            .set({ status: 'FAILED', response_redacted: toJson(redact(result)) })
            .where('id', '=', adjustmentId)
            .execute();
          this.logger.error(
            { adjustmentId, alert: 'REFUND_FAILED' },
            'Refund failed at the provider',
          );
        }
      });
    } catch (error) {
      if (error instanceof ProviderUnreachableError) {
        await this.db
          .updateTable('payment_adjustments')
          .set({ status: 'APPROVED' })
          .where('id', '=', adjustmentId)
          .execute();
        throw error;
      }
      if (!(error instanceof ProviderOutcomeUnknownError)) {
        await this.db
          .updateTable('payment_adjustments')
          .set({ status: 'FAILED' })
          .where('id', '=', adjustmentId)
          .execute();
      }
      this.logger.error({ adjustmentId, err: error, alert: 'REFUND_FAILED' }, 'Refund call failed');
    }
    return DONE;
  }

  private async complete(
    executor: Executor,
    paymentId: string,
    adjustmentId: string,
    providerRef: string,
    actorId: string | null,
    source: 'OPS' | 'PROVIDER',
  ) {
    await executor
      .updateTable('payment_adjustments')
      .set({ status: 'SUCCEEDED', provider_ref: providerRef, completed_at: this.clock.now() })
      .where('id', '=', adjustmentId)
      .execute();
    const payment = await this.transitions.lock(executor, paymentId);
    if (payment?.state === 'COMPLETED') {
      await this.transitions.transition(executor, payment, 'REFUNDED', {
        source,
        actorId,
        reason: 'Refund completed',
      });
    }
  }

  private view(row: {
    id: string;
    reference: string;
    payment_id: string;
    type: string;
    status: string;
    amount_minor: bigint;
    currency: string;
    reason: string;
    requested_by: string | null;
    approved_by: string | null;
    provider_ref: string | null;
    created_at: Date;
  }) {
    return {
      id: row.id,
      reference: row.reference,
      paymentId: row.payment_id,
      type: row.type,
      status: row.status,
      amountMinor: Number(row.amount_minor),
      currency: row.currency,
      reason: row.reason,
      requestedBy: row.requested_by,
      approvedBy: row.approved_by,
      providerRef: row.provider_ref,
      createdAt: row.created_at.toISOString(),
    };
  }
}
