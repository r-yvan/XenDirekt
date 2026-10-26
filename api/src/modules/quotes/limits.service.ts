import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { AppError } from '../../common/errors/app-error';
import { Executor } from '../../database/database.factory';
import type { PaymentState } from '../../database/schema';
import { Clock, startOfKigaliDay } from '../../shared/time/clock';
import type { LimitsConfig } from '../configuration/config-schemas';
import { checkLimits, LimitUsage } from './domain/limits';

/** Payments that did not move money do not consume limits. */
const NON_CONSUMING: PaymentState[] = ['AUTH_FAILED', 'VOIDED'];

@Injectable()
export class LimitsService {
  constructor(private readonly clock: Clock) {}

  async usage(
    executor: Executor,
    ids: { userId: string; cardId: string; payeeId: string },
    limits: LimitsConfig,
  ): Promise<LimitUsage> {
    const dayStart = startOfKigaliDay(this.clock.now());
    const tripStart = new Date(this.clock.nowMs() - limits.tripDays * 86_400_000);
    const row = await executor
      .selectFrom('payments')
      .select([
        sql<string>`coalesce(sum(amount_rwf) FILTER (WHERE user_id = ${ids.userId} AND created_at >= ${dayStart}), 0)`.as(
          'user_today',
        ),
        sql<string>`coalesce(sum(amount_rwf) FILTER (WHERE card_id = ${ids.cardId} AND created_at >= ${dayStart}), 0)`.as(
          'card_today',
        ),
        sql<string>`coalesce(sum(amount_rwf) FILTER (WHERE payee_id = ${ids.payeeId} AND created_at >= ${dayStart}), 0)`.as(
          'payee_today',
        ),
        sql<string>`coalesce(sum(amount_rwf) FILTER (WHERE user_id = ${ids.userId} AND created_at >= ${tripStart}), 0)`.as(
          'user_trip',
        ),
      ])
      .where((eb) =>
        eb.or([
          eb('user_id', '=', ids.userId),
          eb('card_id', '=', ids.cardId),
          eb('payee_id', '=', ids.payeeId),
        ]),
      )
      .where('created_at', '>=', tripStart < dayStart ? tripStart : dayStart)
      .where('state', 'not in', NON_CONSUMING)
      .executeTakeFirstOrThrow();
    return {
      userToday: BigInt(row.user_today),
      cardToday: BigInt(row.card_today),
      payeeToday: BigInt(row.payee_today),
      userTrip: BigInt(row.user_trip),
    };
  }

  async assertWithinLimits(
    executor: Executor,
    ids: { userId: string; cardId: string; payeeId: string },
    amountRwf: bigint,
    limits: LimitsConfig,
  ): Promise<void> {
    const breach = checkLimits(amountRwf, await this.usage(executor, ids, limits), limits);
    if (breach === 'PER_PAYMENT_MIN' || breach === 'PER_PAYMENT_MAX') {
      throw new AppError('AMOUNT_OUT_OF_RANGE', undefined, {
        minRwf: limits.minPaymentRwf,
        maxRwf: limits.maxPaymentRwf,
      });
    }
    if (breach) {
      // Identity verification would raise limits (FR-ONB-06) but no KYC partner is configured.
      throw new AppError('LIMIT_EXCEEDED', undefined, {
        limit: breach,
        identityVerificationAvailable: false,
      });
    }
  }
}
