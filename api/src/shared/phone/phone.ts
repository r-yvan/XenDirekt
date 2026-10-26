import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/** A Rwandan mobile number in the three shapes the system needs. */
export interface RwandaMsisdn {
  /** +250788123456 */
  e164: string;
  /** 0788123456: the format the XentriPay payout API expects (XP §5.2). */
  local: string;
  /** 078 812 3456: human display grouping. */
  display: string;
  /** Two digits after the leading 7-series marker, used for network routing: "78". */
  prefix: string;
}

/**
 * Accepts the ways people paste or type a Rwandan mobile number: 0788123456, 788123456,
 * +250 788 123 456, 250788123456, 00250788123456, with spaces, dashes, dots or brackets.
 * Returns null when the input is not a Rwandan mobile number. Network routing is a separate step.
 */
export function parseRwandaMsisdn(input: string): RwandaMsisdn | null {
  const compact = input.replace(/[\s\-.()]/g, '');
  if (!/^\+?\d+$/.test(compact)) {
    return null;
  }
  let digits = compact.replace(/^\+/, '');
  if (digits.startsWith('00250')) {
    digits = digits.slice(2);
  }
  let national: string;
  if (digits.startsWith('250') && digits.length === 12) {
    national = digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    national = digits.slice(1);
  } else if (digits.length === 9) {
    national = digits;
  } else {
    return null;
  }
  if (!/^7\d{8}$/.test(national)) {
    return null;
  }
  const local = `0${national}`;
  return {
    e164: `+250${national}`,
    local,
    display: `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`,
    prefix: national.slice(0, 2),
  };
}

/**
 * The tourist's own phone (international). Must be supplied in E.164 form with a leading "+"
 * because the device region of a visitor says nothing about their number's country.
 */
export function normaliseInternationalPhone(input: string): string | null {
  const compact = input.replace(/[\s\-.()]/g, '');
  if (!compact.startsWith('+')) {
    return null;
  }
  const parsed = parsePhoneNumberFromString(compact);
  if (!parsed || !parsed.isValid()) {
    return null;
  }
  return parsed.number;
}

/** MoMo Pay merchant codes are digits only; the length range is configuration (default 5–8). */
export function normaliseMerchantCode(input: string, minLength = 5, maxLength = 8): string | null {
  const compact = input.replace(/\s/g, '');
  if (!/^\d+$/.test(compact) || compact.length < minLength || compact.length > maxLength) {
    return null;
  }
  return compact;
}
