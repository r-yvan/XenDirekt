import { scrubCardNumbers } from '../../../common/logging/redaction';
import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { type AuthenticatedUser } from '../../../common/decorators/auth.decorators';
import { AppError } from '../../../common/errors/app-error';
import { InjectDatabase } from '../../../database/database.module';
import type { DB, PaymentState } from '../../../database/schema';
import { OutboxService } from '../../../jobs/outbox/outbox.service';
import { sha256Hex } from '../../../shared/crypto/tokens';
import { generatePublicReference } from '../../../shared/references/public-reference';
import { Clock } from '../../../shared/time/clock';
import { StepUpService } from '../../auth/step-up.service';
import { CardsService } from '../../cards/cards.service';
import { ConfigurationService } from '../../configuration/configuration.service';
import { PayeesService } from '../../payees/payees.service';
import { ProviderGateway } from '../../provider/provider.gateway';
import { LimitsService } from '../../quotes/limits.service';
import { QuotesService } from '../../quotes/quotes.service';
import { BlocklistService } from '../../risk/blocklist.service';
import { HISTORY_FILTERS } from '../dto/payments.dto';
import { PaymentTransitionsService } from './payment-transitions.service';
import { paymentView, PaymentView } from './payment-view';

export const PAYMENT_JOBS = {
  authorise: 'payment.authorise',
  pollAuthorisation: 'payment.poll_authorisation',
  payout: 'payment.payout',
  pollPayout: 'payment.poll_payout',
  capture: 'payment.capture',
  pollCapture: 'payment.poll_capture',
  void: 'payment.void',
  pollVoid: 'payment.poll_void',
  reconcileReview: 'payment.reconcile_review',
} as const;

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;

const FILTER_STATES: Record<(typeof HISTORY_FILTERS)[number], PaymentState[] | null> = {
  ALL: null,
  COMPLETED: ['COMPLETED'],
  IN_PROGRESS: [
    'QUOTED',
    'AUTH_PENDING',
    'AUTHORISED',
    'PAYOUT_PENDING',
    'CAPTURE_PENDING',
    'PAYOUT_FAILED',
    'VOID_PENDING',
  ],
  FAILED: ['AUTH_FAILED', 'VOIDED'],
  IN_REVIEW: ['PENDING_REVIEW', 'CAPTURE_FAILED'],
  REFUNDED: ['REFUNDED'],
};

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const pgError = error as { code?: string; constraint?: string };
  return pgError?.code === '23505' && pgError.constraint === constraint;
}

/**
 * Payment creation and reads (FR-EXE-01). Creation does no provider work: it validates, persists
 * the payment and its first outbox job in one short transaction, and returns immediately. The
 * orchestrator does the rest asynchronously (ADR 0003).
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly transitions: PaymentTransitionsService,
    private readonly outbox: OutboxService,
    private readonly stepUp: StepUpService,
    private readonly quotes: QuotesService,
    private readonly cards: CardsService,
    private readonly payees: PayeesService,
    private readonly limits: LimitsService,
    private readonly blocklist: BlocklistService,
    private readonly configuration: ConfigurationService,
    private readonly provider: ProviderGateway,
  ) {}

  /**
   * Same key + same request → the original payment (no new charge). Same key + different
   * request → IDEMPOTENCY_KEY_REUSED. Safe under concurrency and restarts (PostgreSQL constraint).
   */
  async create(
    user: AuthenticatedUser,
    input: { quoteId: string; note?: string },
    idempotencyKey: string | undefined,
    stepUpToken: string | undefined,
  ): Promise<{ payment: PaymentView; created: boolean }> {
    if (!idempotencyKey || !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      throw new AppError('IDEMPOTENCY_KEY_REQUIRED');
    }
    // The note reaches the seller by SMS: never let a card number through.
    const note = input.note ? scrubCardNumbers(input.note.trim()) || null : null;
    const requestHash = sha256Hex(JSON.stringify({ quoteId: input.quoteId, note }));

    const replay = await this.findByKey(user.userId, idempotencyKey, requestHash);
    if (replay) {
      return { payment: replay, created: false };
    }
    // A replay above still answers while paused; only new payments are refused.
    if ((await this.configuration.get('LIMITS')).value.paymentsPaused) {
      throw new AppError('PAYMENTS_PAUSED');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const outcome = await this.insertPayment(
          user,
          input.quoteId,
          note,
          idempotencyKey,
          requestHash,
          stepUpToken,
        );
        return { payment: outcome.view, created: outcome.created };
      } catch (error) {
        if (isUniqueViolation(error, 'payments_user_id_idempotency_key_key')) {
          const concurrent = await this.findByKey(user.userId, idempotencyKey, requestHash);
          if (concurrent) {
            return { payment: concurrent, created: false };
          }
        }
        if (isUniqueViolation(error, 'payments_quote_id_key')) {
          throw new AppError('QUOTE_ALREADY_USED');
        }
        if (!isUniqueViolation(error, 'payments_reference_key')) {
          throw error;
        }
        // Public reference collision (~1 in 10^9): retry with a new reference.
      }
    }
    throw new AppError('INTERNAL_ERROR');
  }

  private async findByKey(
    userId: string,
    key: string,
    requestHash: string,
  ): Promise<PaymentView | null> {
    const existing = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('user_id', '=', userId)
      .where('idempotency_key', '=', key)
      .executeTakeFirst();
    if (!existing) {
      return null;
    }
    if (existing.request_hash !== requestHash) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED');
    }
    return paymentView(existing);
  }

  private async insertPayment(
    user: AuthenticatedUser,
    quoteId: string,
    note: string | null,
    idempotencyKey: string,
    requestHash: string,
    stepUpToken: string | undefined,
  ): Promise<{ view: PaymentView; created: boolean }> {
    const limits = await this.configuration.get('LIMITS');
    return this.db.transaction().execute(async (trx) => {
      // Serialise payment creation per user so concurrent requests cannot both pass the limits.
      await trx
        .selectFrom('users')
        .select('id')
        .where('id', '=', user.userId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      // Re-check under the lock: a concurrent request with the same key may have just committed.
      const raced = await trx
        .selectFrom('payments')
        .selectAll()
        .where('user_id', '=', user.userId)
        .where('idempotency_key', '=', idempotencyKey)
        .executeTakeFirst();
      if (raced) {
        if (raced.request_hash !== requestHash) {
          throw new AppError('IDEMPOTENCY_KEY_REUSED');
        }
        return { view: paymentView(raced), created: false };
      }
      await this.stepUp.consume(trx, user, 'PAYMENT', stepUpToken);
      const quote = await this.quotes.requireUsable(user.userId, quoteId, trx);
      const card = await this.cards.ownedActive(trx, user.userId, quote.card_id);
      if (await this.blocklist.isBlocked('CARD_FINGERPRINT', card.fingerprint, trx)) {
        throw new AppError('CARD_NOT_ACTIVE');
      }
      const payee = await trx
        .selectFrom('payees')
        .selectAll()
        .where('id', '=', quote.payee_id)
        .executeTakeFirstOrThrow();
      if (payee.lookup_status !== 'VERIFIED' || !payee.registered_name) {
        throw new AppError('PAYEE_NOT_FOUND');
      }
      if (await this.blocklist.isBlocked('PAYEE', payee.id, trx)) {
        throw new AppError('PAYEE_BLOCKED');
      }
      await this.limits.assertWithinLimits(
        trx,
        { userId: user.userId, cardId: card.id, payeeId: payee.id },
        quote.amount_rwf,
        limits.value,
      );

      const now = this.clock.now();
      const inserted = await trx
        .insertInto('payments')
        .values({
          reference: generatePublicReference('XD'),
          user_id: user.userId,
          card_id: card.id,
          payee_id: payee.id,
          quote_id: quote.id,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          device_id_hash: user.deviceIdHash,
          state: 'QUOTED',
          amount_rwf: quote.amount_rwf,
          fee_rwf: quote.fee_rwf,
          total_rwf: quote.total_rwf,
          card_currency: quote.card_currency,
          fx_rate: quote.fx_rate,
          total_card_minor: quote.total_card_minor,
          note,
          provider: this.provider.name,
          is_simulated: this.provider.simulated,
          // NFR-RSK-01: 3-D Secure on the first payment of every card.
          three_ds_required: card.first_payment_at === null,
          payee_name_snapshot: payee.registered_name,
          payee_identifier_masked: this.payees.mask(payee.identifier_type, payee.identifier),
          card_brand_snapshot: card.brand,
          card_last4_snapshot: card.last4,
          quoted_at: quote.created_at,
          state_changed_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.updateTable('quotes').set({ status: 'USED' }).where('id', '=', quote.id).execute();
      await trx
        .insertInto('user_payees')
        .values({
          user_id: user.userId,
          payee_id: payee.id,
          last_used_at: now,
          last_amount_rwf: quote.amount_rwf,
          payment_count: 1,
        })
        .onConflict((oc) =>
          oc.columns(['user_id', 'payee_id']).doUpdateSet({
            last_used_at: now,
            last_amount_rwf: quote.amount_rwf,
            payment_count: sql`user_payees.payment_count + 1`,
          }),
        )
        .execute();
      await this.transitions.recordEvent(trx, inserted.id, {
        to: 'QUOTED',
        type: 'PAYMENT_CREATED',
        source: 'APP',
        actorId: user.userId,
        payload: { quoteId: quote.id, idempotencyKey },
      });
      await this.outbox.enqueue(trx, {
        type: PAYMENT_JOBS.authorise,
        aggregateType: 'payment',
        aggregateId: inserted.id,
        payload: { paymentId: inserted.id },
        dedupeKey: `payment:${inserted.id}:authorise`,
      });
      return { view: paymentView(inserted), created: true };
    });
  }

  /** Ownership is part of the query: another user's payment is simply not found (scenario 14). */
  async get(user: AuthenticatedUser, paymentId: string): Promise<PaymentView> {
    const row = await this.db
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', paymentId)
      .where('user_id', '=', user.userId)
      .executeTakeFirst();
    if (!row) {
      throw new AppError('NOT_FOUND');
    }
    return paymentView(row);
  }

  async list(
    user: AuthenticatedUser,
    query: { status?: (typeof HISTORY_FILTERS)[number]; cursor?: string; limit?: number },
  ) {
    const limit = query.limit ?? 20;
    let builder = this.db
      .selectFrom('payments')
      .selectAll()
      .where('user_id', '=', user.userId)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1);
    const states = FILTER_STATES[query.status ?? 'ALL'];
    if (states) {
      builder = builder.where('state', 'in', states);
    }
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      builder = builder.where((eb) =>
        eb.or([
          eb('created_at', '<', cursor.createdAt),
          eb.and([eb('created_at', '=', cursor.createdAt), eb('id', '<', cursor.id)]),
        ]),
      );
    }
    const rows = await builder.execute();
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      payments: page.map(paymentView),
      nextCursor: rows.length > limit && last ? encodeCursor(last.created_at, last.id) : null,
    };
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      c: string;
      i: string;
    };
    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/.test(parsed.i)) {
      throw new Error('bad cursor');
    }
    return { createdAt, id: parsed.i };
  } catch {
    throw new AppError('VALIDATION_FAILED', undefined, { fields: ['cursor: invalid'] });
  }
}
