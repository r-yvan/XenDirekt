import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signature scheme for the MOCK provider's simulated callbacks only. It is ours, not a partner's:
 * XentriPay has published no webhook signature contract, so none is assumed for it (OQ-11).
 * Header: `X-Mock-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`.
 */
export const MOCK_SIGNATURE_HEADER = 'x-mock-signature';
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export function signMockWebhook(
  secret: string,
  rawBody: string | Buffer,
  timestampSeconds: number,
): string {
  const mac = createHmac('sha256', secret)
    .update(`${timestampSeconds}.`)
    .update(rawBody)
    .digest('hex');
  return `t=${timestampSeconds},v1=${mac}`;
}

export type SignatureCheck = 'VALID' | 'MALFORMED' | 'STALE' | 'MISMATCH';

export function verifyMockWebhook(
  secret: string,
  rawBody: Buffer,
  header: string | undefined,
  nowSeconds: number,
): SignatureCheck {
  const match = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header ?? '');
  if (!match) {
    return 'MALFORMED';
  }
  const timestamp = Number(match[1]);
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    return 'STALE';
  }
  const expected = Buffer.from(signMockWebhook(secret, rawBody, timestamp).slice(-64), 'hex');
  return timingSafeEqual(expected, Buffer.from(match[2]!, 'hex')) ? 'VALID' : 'MISMATCH';
}
