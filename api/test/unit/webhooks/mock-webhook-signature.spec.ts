import {
  signMockWebhook,
  verifyMockWebhook,
} from '../../../src/modules/webhooks/mock-webhook-signature';

describe('mock webhook signature', () => {
  const secret = 'unit-test-secret';
  const body = Buffer.from('{"id":"evt_1"}');
  const now = 1_800_000_000;

  it('accepts a fresh, correct signature', () => {
    expect(verifyMockWebhook(secret, body, signMockWebhook(secret, body, now), now + 10)).toBe(
      'VALID',
    );
  });

  it('rejects a changed body, wrong secret, stale timestamp and malformed header', () => {
    const header = signMockWebhook(secret, body, now);
    expect(verifyMockWebhook(secret, Buffer.from('{"id":"evt_2"}'), header, now)).toBe('MISMATCH');
    expect(verifyMockWebhook('other', body, header, now)).toBe('MISMATCH');
    expect(verifyMockWebhook(secret, body, header, now + 301)).toBe('STALE');
    expect(verifyMockWebhook(secret, body, header, now - 301)).toBe('STALE');
    expect(verifyMockWebhook(secret, body, undefined, now)).toBe('MALFORMED');
    expect(verifyMockWebhook(secret, body, 't=1,v1=zz', now)).toBe('MALFORMED');
  });
});
