import type { LimitsConfig } from '../../configuration/config-schemas';

export interface LimitUsage {
  userToday: bigint;
  cardToday: bigint;
  payeeToday: bigint;
  userTrip: bigint;
}

export type LimitBreach =
  | 'PER_PAYMENT_MIN'
  | 'PER_PAYMENT_MAX'
  | 'PER_USER_DAILY'
  | 'PER_CARD_DAILY'
  | 'PER_PAYEE_DAILY'
  | 'PER_USER_TRIP';

/** NFR-RSK-02. Pure: usage is computed by the caller from durable payment records. */
export function checkLimits(
  amountRwf: bigint,
  usage: LimitUsage,
  limits: LimitsConfig,
): LimitBreach | null {
  if (amountRwf < BigInt(limits.minPaymentRwf)) {
    return 'PER_PAYMENT_MIN';
  }
  if (amountRwf > BigInt(limits.maxPaymentRwf)) {
    return 'PER_PAYMENT_MAX';
  }
  if (usage.userToday + amountRwf > BigInt(limits.perUserDailyRwf)) {
    return 'PER_USER_DAILY';
  }
  if (usage.cardToday + amountRwf > BigInt(limits.perCardDailyRwf)) {
    return 'PER_CARD_DAILY';
  }
  if (usage.payeeToday + amountRwf > BigInt(limits.perPayeeDailyRwf)) {
    return 'PER_PAYEE_DAILY';
  }
  if (usage.userTrip + amountRwf > BigInt(limits.perUserTripRwf)) {
    return 'PER_USER_TRIP';
  }
  return null;
}
