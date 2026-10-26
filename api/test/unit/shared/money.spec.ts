import {
  formatMinorAsDecimal,
  formatMoneyForDisplay,
  isSupportedCurrency,
} from '../../../src/shared/money/currency';
import {
  applySpread,
  convertRwfToCardMinor,
  formatRate,
  parseRate,
} from '../../../src/shared/money/fx';
import { Money } from '../../../src/shared/money/money';

describe('Money', () => {
  it('adds and compares in the same currency only', () => {
    const total = Money.rwf(12_000).plus(Money.rwf(300));
    expect(total.amountMinor).toBe(12_300n);
    expect(total.compare(Money.rwf(12_300))).toBe(0);
    expect(() => Money.rwf(1).plus(Money.of(1n, 'USD'))).toThrow('Currency mismatch');
  });

  it('rejects unknown currencies and unsafe numbers', () => {
    expect(() => Money.of(1n, 'XYZ')).toThrow('Unsupported currency');
    expect(() => Money.rwf(1.5)).toThrow();
    expect(() => Money.rwf(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it('formats for display with grouping and minor units', () => {
    expect(formatMoneyForDisplay(12_000n, 'RWF')).toBe('RWF 12,000');
    expect(formatMoneyForDisplay(847n, 'USD')).toBe('USD 8.47');
    expect(formatMoneyForDisplay(123_456_789n, 'EUR')).toBe('EUR 1,234,567.89');
    expect(formatMinorAsDecimal(5n, 'USD')).toBe('0.05');
    expect(formatMinorAsDecimal(1200n, 'JPY')).toBe('1200');
  });

  it('knows supported currencies', () => {
    expect(isSupportedCurrency('RWF')).toBe(true);
    expect(isSupportedCurrency('usd')).toBe(false);
  });
});

describe('FX', () => {
  it('parses and formats rates exactly', () => {
    expect(parseRate('1450.25')).toBe(145_025_000_000n);
    expect(parseRate('1')).toBe(100_000_000n);
    expect(formatRate(parseRate('1450.25'))).toBe('1450.25');
    expect(formatRate(parseRate('1580'))).toBe('1580');
    expect(formatRate(parseRate('0.00000001'))).toBe('0.00000001');
  });

  it.each(['0', '-1', '1e3', '1.123456789', 'abc', '', '1,450.25'])(
    'rejects invalid rate %p',
    (raw) => {
      expect(() => parseRate(raw)).toThrow();
    },
  );

  it('converts RWF to card minor units rounding up by default', () => {
    const rate = parseRate('1450.25');
    // 12,300 RWF / 1450.25 = 8.4813... USD → 849 cents when rounding up
    expect(convertRwfToCardMinor(12_300n, rate, 'USD')).toBe(849n);
    expect(convertRwfToCardMinor(12_300n, rate, 'USD', 'HALF_UP')).toBe(848n);
  });

  it('does not round when the conversion is exact', () => {
    expect(convertRwfToCardMinor(14_500n, parseRate('1450'), 'USD')).toBe(1_000n);
    expect(convertRwfToCardMinor(14_500n, parseRate('1450'), 'USD', 'HALF_UP')).toBe(1_000n);
  });

  it('handles zero-exponent card currencies and RWF identity', () => {
    // 1 JPY = 9.5 RWF → 1000 RWF = 105.26 JPY → 106 JPY rounded up
    expect(convertRwfToCardMinor(1_000n, parseRate('9.5'), 'JPY')).toBe(106n);
    expect(convertRwfToCardMinor(1_000n, parseRate('1'), 'RWF')).toBe(1_000n);
  });

  it('half-up rounds a remainder of exactly half upwards', () => {
    // 1 RWF at 2 RWF/USD = 0.5 USD = 50 cents exactly; 1 RWF at 200 RWF/USD = 0.5 cents → 1 cent
    expect(convertRwfToCardMinor(1n, parseRate('200'), 'USD', 'HALF_UP')).toBe(1n);
    expect(convertRwfToCardMinor(1n, parseRate('201'), 'USD', 'HALF_UP')).toBe(0n);
    expect(convertRwfToCardMinor(1n, parseRate('201'), 'USD', 'CEILING')).toBe(1n);
  });

  it('applies a spread against the customer', () => {
    const mid = parseRate('1450');
    expect(formatRate(applySpread(mid, 0))).toBe('1450');
    expect(formatRate(applySpread(mid, 100))).toBe('1435.5'); // 1% fewer RWF per USD
    expect(() => applySpread(mid, -1)).toThrow();
    expect(() => applySpread(mid, 10_000)).toThrow();
    expect(() => applySpread(mid, 1.5)).toThrow();
  });

  it('rejects negative amounts', () => {
    expect(() => convertRwfToCardMinor(-1n, parseRate('1450'), 'USD')).toThrow();
  });
});
