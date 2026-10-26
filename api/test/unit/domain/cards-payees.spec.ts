import {
  checkCardEligibility,
  namesMatch,
} from '../../../src/modules/cards/domain/card-eligibility';
import { PLACEHOLDER_CONFIG } from '../../../src/modules/configuration/config-schemas';
import { resolvePayeeIdentifier } from '../../../src/modules/payees/domain/payee-identifier';
import type { ProviderCardDetails } from '../../../src/modules/provider/domain/payment-provider';

const card: ProviderCardDetails = {
  token: 't',
  brand: 'VISA',
  last4: '4242',
  expiryMonth: 12,
  expiryYear: 2029,
  issuingCountry: 'CA',
  funding: 'CREDIT',
  currency: 'CAD',
  fingerprint: 'fp',
  binPrefix: '424242',
  cardholderName: null,
  threeDsVerified: true,
};
const context = {
  rules: PLACEHOLDER_CONFIG.CARD_RULES,
  profileCountry: 'CA',
  profileName: 'Oliver Martin',
  fingerprintBlocked: false,
  now: new Date('2026-11-02T00:00:00Z'),
};

describe('card eligibility (FR-CRD-03, NFR-RSK-04)', () => {
  it('accepts a foreign Visa matching the profile', () => {
    expect(checkCardEligibility(card, context)).toBeNull();
  });

  it.each([
    [{ issuingCountry: 'RW' }, 'ISSUED_IN_RWANDA_OR_BLOCKED_COUNTRY'],
    [{ funding: 'PREPAID' as const }, 'PREPAID'],
    [{ brand: 'OTHER' as const }, 'BRAND_NOT_SUPPORTED'],
    [{ expiryYear: 2026, expiryMonth: 10 }, 'EXPIRED'],
    [{ issuingCountry: 'BR' }, 'COUNTRY_MISMATCH'],
    [{ cardholderName: 'JANE DOE' }, 'NAME_MISMATCH'],
  ])('rejects %p as %s', (override, reason) => {
    expect(checkCardEligibility({ ...card, ...override }, context)).toBe(reason);
  });

  it('rejects blocked BIN ranges and fingerprints', () => {
    expect(
      checkCardEligibility(card, {
        ...context,
        rules: { ...context.rules, blockedBinPrefixes: ['424242'] },
      }),
    ).toBe('BLOCKED_BIN');
    expect(checkCardEligibility(card, { ...context, fingerprintBlocked: true })).toBe(
      'BLOCKED_FINGERPRINT',
    );
  });

  it('accepts a card that expires at the end of the current month', () => {
    expect(
      checkCardEligibility({ ...card, expiryYear: 2026, expiryMonth: 11 }, context),
    ).toBeNull();
  });

  it('matches names leniently but meaningfully', () => {
    expect(namesMatch('O MARTIN', 'Oliver Martin')).toBe(true);
    expect(namesMatch('Zoë Durand', 'zoe durand')).toBe(true);
    expect(namesMatch('JANE DOE', 'Oliver Martin')).toBe(false);
  });
});

describe('payee identifier routing (ADR 0008)', () => {
  const routing = PLACEHOLDER_CONFIG.PAYEE_ROUTING;

  it('normalises MTN numbers in any common format', () => {
    for (const input of ['0788123456', '+250 788 123 456', '788-123-456']) {
      expect(resolvePayeeIdentifier('PHONE', input, routing)).toMatchObject({
        network: 'MTN',
        identifier: '+250788123456',
        localMsisdn: '0788123456',
        masked: '078* *** 456',
      });
    }
  });

  it('refuses other Rwandan networks without naming them, and invalid input', () => {
    expect(resolvePayeeIdentifier('PHONE', '0722123456', routing)).toBe('NETWORK_NOT_SUPPORTED');
    expect(resolvePayeeIdentifier('PHONE', '0731234567', routing)).toBe('NETWORK_NOT_SUPPORTED');
    expect(resolvePayeeIdentifier('PHONE', '12345', routing)).toBe('INVALID');
  });

  it('accepts merchant codes within the configured length', () => {
    expect(resolvePayeeIdentifier('MERCHANT_CODE', '123 456', routing)).toMatchObject({
      identifierType: 'MERCHANT_CODE',
      identifier: '123456',
    });
    expect(resolvePayeeIdentifier('MERCHANT_CODE', '12', routing)).toBe('INVALID');
  });
});
