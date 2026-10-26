/**
 * Redaction applied to anything that may be logged or persisted as a "redacted payload":
 * provider responses, audit snapshots, payment event payloads. It removes secrets entirely,
 * masks personal data and scrubs anything that looks like a card number.
 */

const SECRET_KEYS = new Set(
  [
    'pin',
    'newpin',
    'otp',
    'otpcode',
    'password',
    'secret',
    'token',
    'accesstoken',
    'refreshtoken',
    'stepuptoken',
    'providertoken',
    'apikey',
    'api_key',
    'authorization',
    'x-xentripay-key',
    'authkey',
    'cookie',
    'set-cookie',
    'pan',
    'cardnumber',
    'card_number',
    'cvv',
    'cvc',
    'cvv2',
    'signature',
    'totp',
    'totpsecret',
    'privatekey',
  ].map((key) => key.toLowerCase()),
);

const PERSONAL_KEYS = new Set(
  [
    'email',
    'msisdn',
    'cnumber',
    'phone',
    'phonee164',
    'destination',
    'name',
    'cname',
    'fullname',
    'validatedaccountname',
    'registeredname',
    'accountname',
    'dateofbirth',
    'dob',
  ].map((key) => key.toLowerCase()),
);

const MAX_DEPTH = 8;

/** Luhn check for digit strings, used to recognise card numbers embedded in free text. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) {
      return false;
    }
    if (double) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const CANDIDATE_PAN = /\b(?:\d[ -]?){12,18}\d\b/g;

/** Replaces any 13–19 digit sequence that passes the Luhn check (spaces/dashes allowed). */
export function scrubCardNumbers(text: string): string {
  return text.replace(CANDIDATE_PAN, (match) => {
    const digits = match.replace(/[ -]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && passesLuhn(digits)) {
      return '[REDACTED_PAN]';
    }
    return match;
  });
}

export function maskValue(value: string): string {
  if (value.length <= 4) {
    return '***';
  }
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

/** Deep-copies `input`, dropping secrets, masking personal data and scrubbing card numbers. */
export function redact(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return '[TRUNCATED]';
  }
  if (input === null || input === undefined) {
    return input;
  }
  if (typeof input === 'string') {
    return scrubCardNumbers(input);
  }
  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }
  if (typeof input === 'bigint') {
    return input.toString();
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (input instanceof Error) {
    // Keep it an Error so log serializers still see name, message and stack; scrub card numbers.
    const copy = new Error(scrubCardNumbers(input.message));
    copy.name = input.name;
    copy.stack = input.stack ? scrubCardNumbers(input.stack) : undefined;
    const code = (input as { code?: unknown }).code;
    if (typeof code === 'string') {
      (copy as Error & { code?: string }).code = code;
    }
    return copy;
  }
  if (Buffer.isBuffer(input)) {
    return '[BINARY]';
  }
  if (Array.isArray(input)) {
    return input.map((item) => redact(item, depth + 1));
  }
  if (typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const normalised = key.toLowerCase();
      if (SECRET_KEYS.has(normalised)) {
        output[key] = '[REDACTED]';
      } else if (PERSONAL_KEYS.has(normalised) && typeof value === 'string') {
        output[key] = maskValue(value);
      } else {
        output[key] = redact(value, depth + 1);
      }
    }
    return output;
  }
  return '[UNSUPPORTED]';
}
