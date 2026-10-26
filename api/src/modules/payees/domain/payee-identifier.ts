import { maskLocalMsisdn } from '../../../common/logging/masking';
import { normaliseMerchantCode, parseRwandaMsisdn } from '../../../shared/phone/phone';
import type { PayeeRouting } from '../../configuration/config-schemas';

export type IdentifierType = 'PHONE' | 'MERCHANT_CODE';

export type ResolvedIdentifier = {
  network: 'MTN';
  identifierType: IdentifierType;
  /** E.164 (phones) or digits (merchant codes): what is stored and sent to the partner. */
  identifier: string;
  /** 0788123456 for phones; null for merchant codes. */
  localMsisdn: string | null;
  display: string;
  masked: string;
};

export type IdentifierProblem = 'INVALID' | 'NETWORK_NOT_SUPPORTED';

/**
 * Normalises what the tourist typed or pasted (FR-PAY-01, FR-PAY-06) and routes it (ADR 0008):
 * MTN prefixes only; any other Rwandan mobile number is NETWORK_NOT_SUPPORTED. There is no
 * override. The partner's name lookup remains the authority (numbers can be ported).
 */
export function resolvePayeeIdentifier(
  type: IdentifierType,
  raw: string,
  routing: PayeeRouting,
): ResolvedIdentifier | IdentifierProblem {
  if (type === 'MERCHANT_CODE') {
    const code = normaliseMerchantCode(
      raw,
      routing.merchantCodeMinLength,
      routing.merchantCodeMaxLength,
    );
    if (!code) {
      return 'INVALID';
    }
    return {
      network: 'MTN',
      identifierType: 'MERCHANT_CODE',
      identifier: code,
      localMsisdn: null,
      display: code,
      masked: `${'*'.repeat(Math.max(0, code.length - 3))}${code.slice(-3)}`,
    };
  }
  const phone = parseRwandaMsisdn(raw);
  if (!phone) {
    return 'INVALID';
  }
  if (!routing.mtnPrefixes.includes(phone.prefix)) {
    return 'NETWORK_NOT_SUPPORTED';
  }
  return {
    network: 'MTN',
    identifierType: 'PHONE',
    identifier: phone.e164,
    localMsisdn: phone.local,
    display: phone.display,
    masked: maskLocalMsisdn(phone.local),
  };
}

export function localMsisdnFromE164(e164: string): string | null {
  return parseRwandaMsisdn(e164)?.local ?? null;
}
