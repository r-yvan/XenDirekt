/**
 * Deterministic sandbox scenarios (documented in docs/testing.md). Nothing here represents a real
 * card, person or account; every name is prefixed "SANDBOX".
 */
export interface MockCard {
  key: string;
  label: string;
  brand: 'VISA' | 'MASTERCARD';
  last4: string;
  /** null = use the customer's country of residence (the happy-path card). */
  issuingCountry: string | null;
  funding: 'CREDIT' | 'DEBIT' | 'PREPAID';
  currency: string | null;
  behaviour: 'OK' | 'ALWAYS_3DS' | 'DECLINE' | 'CAPTURE_FAILS' | 'SETUP_FAILS';
}

export const MOCK_CARDS: MockCard[] = [
  {
    key: 'visa-home',
    label: 'Visa •••• 4242 · credit · issued in your country',
    brand: 'VISA',
    last4: '4242',
    issuingCountry: null,
    funding: 'CREDIT',
    currency: null,
    behaviour: 'OK',
  },
  {
    key: 'mc-home',
    label: 'Mastercard •••• 4444 · debit · issued in your country',
    brand: 'MASTERCARD',
    last4: '4444',
    issuingCountry: null,
    funding: 'DEBIT',
    currency: null,
    behaviour: 'OK',
  },
  {
    key: 'visa-3ds',
    label: 'Visa •••• 1881 · asks 3-D Secure on every payment',
    brand: 'VISA',
    last4: '1881',
    issuingCountry: null,
    funding: 'CREDIT',
    currency: null,
    behaviour: 'ALWAYS_3DS',
  },
  {
    key: 'visa-decline',
    label: 'Visa •••• 0002 · issuer declines payments',
    brand: 'VISA',
    last4: '0002',
    issuingCountry: null,
    funding: 'CREDIT',
    currency: null,
    behaviour: 'DECLINE',
  },
  {
    key: 'visa-capture-fails',
    label: 'Visa •••• 0341 · capture fails after payout',
    brand: 'VISA',
    last4: '0341',
    issuingCountry: null,
    funding: 'CREDIT',
    currency: null,
    behaviour: 'CAPTURE_FAILS',
  },
  {
    key: 'visa-setup-fails',
    label: 'Visa •••• 0119 · 3-D Secure fails when adding',
    brand: 'VISA',
    last4: '0119',
    issuingCountry: null,
    funding: 'CREDIT',
    currency: null,
    behaviour: 'SETUP_FAILS',
  },
  {
    key: 'visa-rwanda',
    label: 'Visa •••• 7700 · issued in Rwanda (not eligible)',
    brand: 'VISA',
    last4: '7700',
    issuingCountry: 'RW',
    funding: 'DEBIT',
    currency: 'RWF',
    behaviour: 'OK',
  },
  {
    key: 'mc-prepaid',
    label: 'Mastercard •••• 9001 · prepaid gift card (not eligible)',
    brand: 'MASTERCARD',
    last4: '9001',
    issuingCountry: null,
    funding: 'PREPAID',
    currency: null,
    behaviour: 'OK',
  },
  {
    key: 'visa-foreign',
    label: 'Visa •••• 5556 · issued in Brazil (country mismatch)',
    brand: 'VISA',
    last4: '5556',
    issuingCountry: 'BR',
    funding: 'CREDIT',
    currency: 'BRL',
    behaviour: 'OK',
  },
];

/** Card currency by issuing country for the happy-path cards. */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD',
  CA: 'CAD',
  GB: 'GBP',
  FR: 'EUR',
  DE: 'EUR',
  BE: 'EUR',
  NL: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  AT: 'EUR',
  CH: 'CHF',
  JP: 'JPY',
  AU: 'AUD',
};

/**
 * Payee behaviour by the last four digits of the national number (or merchant code):
 *   0000 not found · 0001 inactive · 0002 lookup unavailable
 *   1111 payout fails · 2222 payout stays pending · 3333 payout times out but succeeds
 *   4444 payout succeeds then is reversed · anything else: payout succeeds.
 */
export type PayeeBehaviour =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'LOOKUP_DOWN'
  | 'PAYOUT_FAILS'
  | 'PAYOUT_STUCK'
  | 'PAYOUT_TIMEOUT'
  | 'PAYOUT_REVERSED'
  | 'OK';

export function payeeBehaviour(identifier: string): PayeeBehaviour {
  const suffix = identifier.slice(-4);
  switch (suffix) {
    case '0000':
      return 'NOT_FOUND';
    case '0001':
      return 'INACTIVE';
    case '0002':
      return 'LOOKUP_DOWN';
    case '1111':
      return 'PAYOUT_FAILS';
    case '2222':
      return 'PAYOUT_STUCK';
    case '3333':
      return 'PAYOUT_TIMEOUT';
    case '4444':
      return 'PAYOUT_REVERSED';
    default:
      return 'OK';
  }
}

const SANDBOX_SHOPS = [
  'Craft Corner',
  'Nyamirambo Market Stall',
  'Moto Ride',
  'Coffee Kiosk',
  'Basket Weavers',
  'Fruit Stand',
];

export function sandboxPayeeName(identifier: string): string {
  const digits = identifier.replace(/\D/g, '');
  const index = Number(digits.slice(-2)) % SANDBOX_SHOPS.length;
  return `SANDBOX ${SANDBOX_SHOPS[index]} ${digits.slice(-3)}`;
}
