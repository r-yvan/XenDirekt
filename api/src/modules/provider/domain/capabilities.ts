/**
 * Everything XenDirekt may ask a payment partner to do. An adapter declares the subset it really
 * implements; the orchestrator checks the declaration before every call, and production startup
 * checks that each critical capability has recorded approval evidence.
 * See docs/provider-capability-matrix.md for the evidence behind each entry.
 */
export const PROVIDER_CAPABILITIES = [
  /** Hosted card setup that returns a reusable token plus trusted card metadata. */
  'CARD_SETUP_TOKENISATION',
  'CARD_THREE_DS',
  /** Authorise (hold) without capturing. */
  'CARD_AUTHORISE',
  'CARD_CAPTURE',
  'CARD_VOID',
  'CARD_REFUND',
  /** Registered-name lookup for an MTN MoMo account before any money moves. */
  'PAYEE_NAME_LOOKUP_MTN',
  /** Unattended payout to an MTN MoMo phone number (no manual approval per payout). */
  'PAYOUT_MTN_PHONE',
  'PAYOUT_MTN_MERCHANT_CODE',
  'PAYOUT_STATUS',
  /** Signed status callbacks with a documented replay-protection contract. */
  'STATUS_WEBHOOKS',
  'SETTLEMENT_REPORTS',
  'FX_QUOTES',
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

/** Without these, real money must not move. */
export const CRITICAL_LIVE_CAPABILITIES: readonly ProviderCapability[] = [
  'CARD_SETUP_TOKENISATION',
  'CARD_THREE_DS',
  'CARD_AUTHORISE',
  'CARD_CAPTURE',
  'CARD_VOID',
  'CARD_REFUND',
  'PAYEE_NAME_LOOKUP_MTN',
  'PAYOUT_MTN_PHONE',
  'PAYOUT_STATUS',
  'SETTLEMENT_REPORTS',
];

/**
 * A pseudo-capability the product owner can approve instead of STATUS_WEBHOOKS when the partner
 * offers no signed callbacks and polling plus reconciliation is accepted for production.
 */
export const STATUS_POLLING_ACCEPTED = 'STATUS_POLLING_ACCEPTED';

export function isProviderCapability(value: string): value is ProviderCapability {
  return (PROVIDER_CAPABILITIES as readonly string[]).includes(value);
}
