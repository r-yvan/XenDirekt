import { randomInt } from 'node:crypto';
import { constantTimeEqual, hmacSha256Hex } from '../../../shared/crypto/tokens';

/** No look-alike characters (0/O, 1/I/L): codes get read out and typed by hand. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export const REFERRAL_CODE_PATTERN = /^[A-HJKMNP-Z2-9]{8}$/;

/** Every friend who joins with your link moves you up this many places. */
export const REFERRAL_BOOST = 5;

export function generateReferralCode(): string {
  let code = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return code;
}

/**
 * The secret in the "leave the waitlist" email link. It is derived (HMAC with domain
 * separation), not stored, so it can be regenerated for any later email. The public referral
 * code cannot be used to manage an entry.
 */
export function manageToken(secret: string, entryId: string): string {
  return `${entryId}.${hmacSha256Hex(secret, `waitlist-manage:${entryId}`).slice(0, 32)}`;
}

export const MANAGE_TOKEN_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9a-f]{32})$/;

/** Returns the entry ID when the token is genuine, otherwise null (constant-time compare). */
export function verifyManageToken(secret: string, token: string): string | null {
  const entryId = MANAGE_TOKEN_PATTERN.exec(token)?.[1];
  if (!entryId) {
    return null;
  }
  return constantTimeEqual(manageToken(secret, entryId), token) ? entryId : null;
}

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** First word of a display name, for a friendly greeting; never the full name. */
export function firstNameOf(fullName: string | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : null;
}
