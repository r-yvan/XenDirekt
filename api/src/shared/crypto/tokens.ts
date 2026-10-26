import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit random token, base64url (refresh tokens, step-up grants, setup nonces). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** For high-entropy tokens a fast hash is sufficient; the token itself is the secret. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hmacSha256Hex(key: string, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Uniformly random numeric code (OTPs). */
export function randomNumericCode(length: number): string {
  let code = '';
  while (code.length < length) {
    // Rejection sampling over a byte avoids modulo bias.
    const byte = randomBytes(1)[0] ?? 255;
    if (byte < 250) {
      code += String(byte % 10);
    }
  }
  return code;
}
