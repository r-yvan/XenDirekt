import { currencyExponent } from './currency';

/**
 * FX rates are "RWF per one major unit of the card currency" (e.g. 1 USD = 1450.25 RWF),
 * held as integers scaled by 10^8. No floating point is used anywhere in conversion.
 */
export const FX_RATE_DECIMALS = 8;
const RATE_SCALE = 10n ** BigInt(FX_RATE_DECIMALS);
const RATE_PATTERN = /^(\d{1,12})(?:\.(\d{1,8}))?$/;

export type RoundingMode = 'CEILING' | 'HALF_UP';

/** "1450.25" → 145025000000n. Rejects negatives, exponents, zero and more than 8 decimals. */
export function parseRate(decimal: string): bigint {
  const match = RATE_PATTERN.exec(decimal.trim());
  if (!match) {
    throw new Error(`Invalid FX rate: "${decimal}"`);
  }
  const whole = BigInt(match[1] ?? '0');
  const fraction = BigInt((match[2] ?? '').padEnd(FX_RATE_DECIMALS, '0'));
  const scaled = whole * RATE_SCALE + fraction;
  if (scaled <= 0n) {
    throw new Error('FX rate must be positive');
  }
  return scaled;
}

/** 145025000000n → "1450.25" (trailing zeros trimmed, at least the integer part). */
export function formatRate(scaled: bigint): string {
  const whole = scaled / RATE_SCALE;
  const fraction = (scaled % RATE_SCALE)
    .toString()
    .padStart(FX_RATE_DECIMALS, '0')
    .replace(/0+$/, '');
  return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}

/** Applies a spread (basis points) against the customer: fewer RWF per card-currency unit. */
export function applySpread(midScaled: bigint, spreadBps: number): bigint {
  if (!Number.isInteger(spreadBps) || spreadBps < 0 || spreadBps >= 10_000) {
    throw new Error('Spread must be an integer between 0 and 9999 basis points');
  }
  const applied = (midScaled * BigInt(10_000 - spreadBps)) / 10_000n;
  if (applied <= 0n) {
    throw new Error('Spread produced a non-positive rate');
  }
  return applied;
}

function divide(numerator: bigint, denominator: bigint, rounding: RoundingMode): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n) {
    return quotient;
  }
  if (rounding === 'CEILING') {
    return quotient + 1n;
  }
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

/**
 * Card-currency minor units needed to fund `amountRwf` at `rateScaled`.
 * cardMinor = amountRwf × 10^exp(card) / rate, rounded with `rounding` (default CEILING so the
 * charged amount always covers the RWF payout plus fee).
 */
export function convertRwfToCardMinor(
  amountRwf: bigint,
  rateScaled: bigint,
  cardCurrency: string,
  rounding: RoundingMode = 'CEILING',
): bigint {
  if (amountRwf < 0n) {
    throw new Error('Amount must not be negative');
  }
  if (rateScaled <= 0n) {
    throw new Error('Rate must be positive');
  }
  if (cardCurrency === 'RWF') {
    return amountRwf;
  }
  const factor = 10n ** BigInt(currencyExponent(cardCurrency));
  return divide(amountRwf * factor * RATE_SCALE, rateScaled, rounding);
}
