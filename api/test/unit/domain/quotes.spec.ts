import { PLACEHOLDER_CONFIG } from '../../../src/modules/configuration/config-schemas';
import { checkLimits } from '../../../src/modules/quotes/domain/limits';
import {
  calculateFee,
  calculateQuote,
  displayRate,
} from '../../../src/modules/quotes/domain/quote-calculator';

const fees = { fixedRwf: 200, percentageBps: 150, minFeeRwf: 200, maxFeeRwf: 5_000 };
const fx = { ...PLACEHOLDER_CONFIG.FX_RATES, rates: { USD: '1450', EUR: '1580', JPY: '9.6' } };

describe('fee calculation', () => {
  it('adds fixed plus percentage, rounding the percentage up to whole RWF', () => {
    expect(calculateFee(12_000n, fees)).toBe(380n); // 200 + 180
    expect(calculateFee(12_001n, fees)).toBe(381n); // 180.015 → 181
    expect(calculateFee(1n, fees)).toBe(201n);
  });

  it('clamps to the configured minimum and maximum', () => {
    expect(calculateFee(10n, { ...fees, fixedRwf: 0, minFeeRwf: 100 })).toBe(100n);
    expect(calculateFee(1_000_000n, fees)).toBe(5_000n);
  });

  it('rejects non-positive amounts', () => {
    expect(() => calculateFee(0n, fees)).toThrow();
    expect(() => calculateFee(-5n, fees)).toThrow();
  });
});

describe('quote calculation', () => {
  it('computes the merchant amount, fee, total and card total exactly', () => {
    const quote = calculateQuote({ amountRwf: 12_000n, cardCurrency: 'USD', fees, fx });
    expect(quote).toMatchObject({
      amountRwf: 12_000n,
      feeRwf: 380n,
      totalRwf: 12_380n,
      fxRate: '1450',
    });
    // 12,380 / 1450 = 8.5379… USD → 854 cents (rounded up)
    expect(quote.totalCardMinor).toBe(854n);
  });

  it('applies the configured spread against the customer', () => {
    const quote = calculateQuote({
      amountRwf: 14_500n,
      cardCurrency: 'USD',
      fees: { ...fees, fixedRwf: 0, percentageBps: 0, minFeeRwf: 0 },
      fx: { ...fx, spreadBps: 100 },
    });
    expect(quote.fxRate).toBe('1435.5');
    expect(quote.totalCardMinor).toBe(1011n); // 14,500 / 1435.5 = 10.1010… → 10.11
  });

  it('handles zero-decimal card currencies', () => {
    expect(
      calculateQuote({
        amountRwf: 1_000n,
        cardCurrency: 'JPY',
        fees: { ...fees, fixedRwf: 0, percentageBps: 0, minFeeRwf: 0 },
        fx,
      }).totalCardMinor,
    ).toBe(105n);
  });

  it('refuses a currency with no configured rate', () => {
    expect(() => calculateQuote({ amountRwf: 1_000n, cardCurrency: 'GBP', fees, fx })).toThrow(
      'No FX rate',
    );
  });

  it('formats the rate for people', () => {
    expect(displayRate('USD', '1450.25')).toBe('1 USD = 1,450.25 RWF');
  });
});

describe('limits', () => {
  const limits = PLACEHOLDER_CONFIG.LIMITS;
  const none = { userToday: 0n, cardToday: 0n, payeeToday: 0n, userTrip: 0n };

  it('enforces the per-payment boundaries inclusively', () => {
    expect(checkLimits(499n, none, limits)).toBe('PER_PAYMENT_MIN');
    expect(checkLimits(500n, none, limits)).toBeNull();
    expect(checkLimits(200_000n, none, limits)).toBeNull();
    expect(checkLimits(200_001n, none, limits)).toBe('PER_PAYMENT_MAX');
  });

  it('counts existing usage against daily, card, payee and trip limits', () => {
    expect(checkLimits(100_000n, { ...none, userToday: 400_000n }, limits)).toBeNull();
    expect(checkLimits(100_001n, { ...none, userToday: 400_000n }, limits)).toBe('PER_USER_DAILY');
    expect(checkLimits(1_000n, { ...none, cardToday: 499_500n }, limits)).toBe('PER_CARD_DAILY');
    expect(checkLimits(1_000n, { ...none, payeeToday: 999_500n }, limits)).toBe('PER_PAYEE_DAILY');
    expect(checkLimits(1_000n, { ...none, userTrip: 1_999_500n }, limits)).toBe('PER_USER_TRIP');
  });
});
