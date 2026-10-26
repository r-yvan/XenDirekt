/** Fixed 6-digit PIN (docs/open-questions.md OQ-21) with a small blocklist of trivial values. */
export const PIN_LENGTH = 6;
export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MS = 15 * 60_000;

export type PinPolicyViolation = 'FORMAT' | 'TRIVIAL';

export function checkPinPolicy(pin: string): PinPolicyViolation | null {
  if (!/^\d{6}$/.test(pin)) {
    return 'FORMAT';
  }
  const digits = pin.split('').map(Number);
  const allSame = digits.every((digit) => digit === digits[0]);
  const ascending = digits.every(
    (digit, index) => index === 0 || digit === ((digits[index - 1] ?? 0) + 1) % 10,
  );
  const descending = digits.every(
    (digit, index) => index === 0 || digit === ((digits[index - 1] ?? 0) + 9) % 10,
  );
  const repeatedPair = pin.slice(0, 2).repeat(3) === pin;
  const repeatedTriple = pin.slice(0, 3).repeat(2) === pin;
  if (allSame || ascending || descending || repeatedPair || repeatedTriple) {
    return 'TRIVIAL';
  }
  return null;
}
