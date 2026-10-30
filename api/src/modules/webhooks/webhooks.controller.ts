import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Kysely } from 'kysely';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AppError } from '../../common/errors/app-error';
import { redact } from '../../common/logging/redaction';
import { AppConfig } from '../../config/app-config';
import { toJson } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB, PaymentState } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { PaymentOrchestrator } from '../payments/application/payment-orchestrator';
import { PAYMENT_JOBS } from '../payments/application/payments.service';
import { ProviderGateway } from '../provider/provider.gateway';
import { MOCK_SIGNATURE_HEADER, verifyMockWebhook } from './mock-webhook-signature';

/** States in which a callback may prompt a status check. Nothing here ever sends money. */
const REPOLL_JOB: Partial<Record<PaymentState, string>> = {
  AUTH_PENDING: PAYMENT_JOBS.pollAuthorisation,
  PAYOUT_PENDING: PAYMENT_JOBS.pollPayout,
  CAPTURE_PENDING: PAYMENT_JOBS.capture,
  VOID_PENDING: PAYMENT_JOBS.void,
  PENDING_REVIEW: PAYMENT_JOBS.reconcileReview,
};

interface PartnerEvent {
  id: string;
  type: string;
  paymentReference: string;
}

function parseEvent(raw: Buffer): PartnerEvent | null {
  try {
    const body = JSON.parse(raw.toString('utf8')) as {
      id?: unknown;
      type?: unknown;
      data?: { paymentReference?: unknown };
    };
    const { id, type } = body;
    const paymentReference = body.data?.paymentReference;
    if (
      typeof id === 'string' &&
      /^[\w-]{1,100}$/.test(id) &&
      typeof type === 'string' &&
      type.length <= 64 &&
      typeof paymentReference === 'string' &&
      paymentReference.length <= 64
    ) {
      return { id, type, paymentReference };
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Partner status callbacks (ADR 0004). A callback is only a hint: it is authenticated, stored
 * once per event ID, and then triggers a status poll of the provider. The payment state changes
 * only from that poll's result, never from the callback body.
 */
@ApiExcludeController()
@Controller('v1/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly gateway: ProviderGateway,
    private readonly orchestrator: PaymentOrchestrator,
    private readonly config: AppConfig,
    private readonly clock: Clock,
  ) {}

  @Post('partner')
  @Public()
  @HttpCode(200)
  @RateLimit({ name: 'webhook-ip', key: 'ip', limit: 600, windowSeconds: 60 })
  async partner(
    @Req() request: RawBodyRequest<Request>,
    @Headers(MOCK_SIGNATURE_HEADER) signature: string | undefined,
  ) {
    const secret = this.config.provider.mock.webhookSecret;
    if (!this.gateway.isUsable('STATUS_WEBHOOKS') || !this.gateway.simulated || !secret) {
      // Real partners: no signature contract is documented, so callbacks are not accepted (OQ-11).
      throw new AppError('CAPABILITY_NOT_CONFIGURED', undefined, { capability: 'STATUS_WEBHOOKS' });
    }
    const raw = request.rawBody ?? Buffer.alloc(0);
    const check = verifyMockWebhook(secret, raw, signature, Math.floor(this.clock.nowMs() / 1000));
    if (check !== 'VALID') {
      // Invalid events are not stored, so forged IDs cannot pre-empt genuine ones.
      this.logger.warn({ check, alert: 'WEBHOOK_SIGNATURE_INVALID' }, 'Rejected partner callback');
      throw new AppError('WEBHOOK_REJECTED');
    }
    const event = parseEvent(raw);
    if (!event) {
      throw new AppError('VALIDATION_FAILED', 'Malformed event.');
    }
    return this.db.transaction().execute(async (trx) => {
      const inserted = await trx
        .insertInto('inbound_provider_events')
        .values({
          provider: this.gateway.name,
          external_event_id: event.id,
          event_type: event.type,
          signature_valid: true,
          payload_redacted: toJson(redact(JSON.parse(raw.toString('utf8')))),
        })
        .onConflict((conflict) => conflict.columns(['provider', 'external_event_id']).doNothing())
        .returning('id')
        .executeTakeFirst();
      if (!inserted) {
        return { received: true, duplicate: true };
      }
      const payment = await trx
        .selectFrom('payments')
        .select(['id', 'state'])
        .where('reference', '=', event.paymentReference)
        .executeTakeFirst();
      const job = payment ? REPOLL_JOB[payment.state] : undefined;
      if (payment && job) {
        await this.orchestrator.enqueue(trx, job, payment.id);
      }
      const outcome = !payment
        ? 'UNKNOWN_PAYMENT'
        : job
          ? 'REPOLL_ENQUEUED'
          : 'IGNORED_NOT_IN_FLIGHT';
      await trx
        .updateTable('inbound_provider_events')
        .set({ processed_at: this.clock.now(), outcome })
        .where('id', '=', inserted.id)
        .execute();
      return { received: true, duplicate: false };
    });
  }
}
