/**
 * ISO 4217 minor-unit exponents for the currencies XenDirekt can quote. RWF has no minor unit.
 * A currency missing here cannot be quoted, which keeps exponent mistakes out of the system.
 */
const EXPONENTS: Readonly<Record<string, number>> = Object.freeze({
  RWF: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  NZD: 2,
  CHF: 2,
  SEK: 2,
  NOK: 2,
  DKK: 2,
  PLN: 2,
  CZK: 2,
  JPY: 0,
  KRW: 0,
  CNY: 2,
  HKD: 2,
  SGD: 2,
  INR: 2,
  AED: 2,
  ILS: 2,
  ZAR: 2,
  KES: 2,
  UGX: 0,
  TZS: 2,
  NGN: 2,
  GHS: 2,
  BRL: 2,
  MXN: 2,
});

export function isSupportedCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXPONENTS, code);
}

export function currencyExponent(code: string): number {
  const exponent = EXPONENTS[code];
  if (exponent === undefined) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return exponent;
}

export function minorUnitFactor(code: string): bigint {
  return 10n ** BigInt(currencyExponent(code));
}

/** 123456n USD → "1234.56"; 12000n RWF → "12000". Plain decimal text, no grouping. */
export function formatMinorAsDecimal(amountMinor: bigint, code: string): string {
  const exponent = currencyExponent(code);
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  if (exponent === 0) {
    return `${negative ? '-' : ''}${absolute.toString()}`;
  }
  const factor = 10n ** BigInt(exponent);
  const whole = absolute / factor;
  const fraction = (absolute % factor).toString().padStart(exponent, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}

/** Display form used in SMS and email, e.g. "RWF 12,000" or "USD 8.47". */
export function formatMoneyForDisplay(amountMinor: bigint, code: string): string {
  const [whole = '0', fraction] = formatMinorAsDecimal(amountMinor, code).split('.');
  const negative = whole.startsWith('-');
  const digits = negative ? whole.slice(1) : whole;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${code} ${negative ? '-' : ''}${grouped}${fraction !== undefined ? `.${fraction}` : ''}`;
}
