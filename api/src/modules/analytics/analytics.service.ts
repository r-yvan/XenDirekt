import { Injectable, OnModuleInit } from '@nestjs/common';
import { Kysely } from 'kysely';
import { type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { AppError } from '../../common/errors/app-error';
import { scrubCardNumbers } from '../../common/logging/redaction';
import { toJson } from '../../database/database.factory';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { Clock } from '../../shared/time/clock';
import { PaymentTransitionsService } from '../payments/application/payment-transitions.service';
import { ANALYTICS_EVENTS, AnalyticsEventName, analyticsBatchSchema } from './analytics-schema';

/** Product analytics without personal data (PRD §10.1): internal IDs only, strict allowlist. */
@Injectable()
export class AnalyticsService implements OnModuleInit {
  constructor(
    @InjectDatabase() private readonly db: Kysely<DB>,
    private readonly clock: Clock,
    private readonly transitions: PaymentTransitionsService,
  ) {}

  onModuleInit(): void {
    // Server-side payment outcome events (time to pay, settlement time) for the success metrics.
    this.transitions.onTransition(async (trx, payment) => {
      const name =
        payment.state === 'COMPLETED'
          ? 'payment_completed'
          : payment.state === 'AUTH_FAILED'
            ? 'payment_failed'
            : payment.state === 'VOIDED'
              ? 'payment_voided'
              : null;
      if (!name) {
        return;
      }
      const now = this.clock.nowMs();
      await trx
        .insertInto('analytics_events')
        .values({
          event_name: name,
          user_id: payment.user_id,
          source: 'SERVER',
          occurred_at: this.clock.now(),
          properties: toJson({
            state: payment.state,
            failureCode: payment.failure_code,
            amountRwf: Number(payment.amount_rwf),
            cardCurrency: payment.card_currency,
            timeToPaySeconds: Math.round((now - payment.created_at.getTime()) / 1000),
            settlementSeconds:
              payment.authorised_at && payment.payout_confirmed_at
                ? Math.round(
                    (payment.payout_confirmed_at.getTime() - payment.authorised_at.getTime()) /
                      1000,
                  )
                : null,
            simulated: payment.is_simulated,
          }),
        })
        .execute();
    });
  }

  async ingest(user: AuthenticatedUser | null, body: unknown): Promise<{ accepted: number }> {
    const batch = analyticsBatchSchema.safeParse(body);
    if (!batch.success) {
      throw new AppError('VALIDATION_FAILED', undefined, { fields: ['events: invalid batch'] });
    }
    const rows = [];
    for (const event of batch.data.events) {
      const schema = ANALYTICS_EVENTS[event.name as AnalyticsEventName];
      const parsed = schema?.strict().safeParse(event.properties);
      if (
        !schema ||
        !parsed?.success ||
        scrubCardNumbers(JSON.stringify(event.properties)) !== JSON.stringify(event.properties)
      ) {
        throw new AppError('VALIDATION_FAILED', undefined, {
          fields: [
            `events: "${event.name.slice(0, 40)}" is not an allowed event or has disallowed properties`,
          ],
        });
      }
      rows.push({
        event_name: event.name,
        user_id: user?.userId ?? null,
        properties: toJson(parsed.data),
        occurred_at: event.occurredAt,
        source: 'APP' as const,
      });
    }
    await this.db.insertInto('analytics_events').values(rows).execute();
    return { accepted: rows.length };
  }
}
