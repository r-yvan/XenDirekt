import type { CardRules } from '../../configuration/config-schemas';
import type { ProviderCardDetails } from '../../provider/domain/payment-provider';

export type IneligibleReason =
  | 'BRAND_NOT_SUPPORTED'
  | 'ISSUED_IN_RWANDA_OR_BLOCKED_COUNTRY'
  | 'PREPAID'
  | 'BLOCKED_BIN'
  | 'BLOCKED_FINGERPRINT'
  | 'EXPIRED'
  | 'COUNTRY_MISMATCH'
  | 'NAME_MISMATCH';

export interface EligibilityContext {
  rules: CardRules;
  profileCountry: string | null;
  profileName: string | null;
  fingerprintBlocked: boolean;
  now: Date;
}

/**
 * FR-CRD-03 and NFR-RSK-04, decided only from TRUSTED provider metadata (never client claims).
 * Returns the first failing rule, or null when the card may be saved.
 */
export function checkCardEligibility(
  card: ProviderCardDetails,
  context: EligibilityContext,
): IneligibleReason | null {
  const { rules } = context;
  if (card.brand === 'OTHER' || !rules.allowedBrands.includes(card.brand)) {
    return 'BRAND_NOT_SUPPORTED';
  }
  if (card.issuingCountry && rules.blockedIssuingCountries.includes(card.issuingCountry)) {
    return 'ISSUED_IN_RWANDA_OR_BLOCKED_COUNTRY';
  }
  if (rules.rejectPrepaid && card.funding === 'PREPAID') {
    return 'PREPAID';
  }
  if (
    card.binPrefix &&
    rules.blockedBinPrefixes.some((prefix) => card.binPrefix!.startsWith(prefix))
  ) {
    return 'BLOCKED_BIN';
  }
  if (context.fingerprintBlocked) {
    return 'BLOCKED_FINGERPRINT';
  }
  const expiry = Date.UTC(card.expiryYear, card.expiryMonth, 1); // first day after expiry month
  if (expiry <= context.now.getTime()) {
    return 'EXPIRED';
  }
  if (
    rules.blockOnCountryMismatch &&
    card.issuingCountry &&
    context.profileCountry &&
    card.issuingCountry !== context.profileCountry
  ) {
    return 'COUNTRY_MISMATCH';
  }
  if (
    rules.blockOnNameMismatch &&
    card.cardholderName &&
    context.profileName &&
    !namesMatch(card.cardholderName, context.profileName)
  ) {
    return 'NAME_MISMATCH';
  }
  return null;
}

function tokens(name: string): Set<string> {
  return new Set(
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((part) => part.length > 1),
  );
}

/** Lenient: cards often abbreviate ("O MARTIN"); require a shared surname-length token. */
export function namesMatch(cardholder: string, profile: string): boolean {
  const card = tokens(cardholder);
  return [...tokens(profile)].some((token) => token.length >= 2 && card.has(token));
}
