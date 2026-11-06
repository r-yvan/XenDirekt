import type { ProviderCapability } from './capabilities';

/**
 * The provider port (ADR 0004). Domain code depends only on these types; adapters map partner
 * payloads into them explicitly. Every money-moving call carries a stable `requestRef` that the
 * adapter sends as the partner's client reference, so status can always be recovered by it.
 */

export interface ProviderCardDetails {
  token: string;
  brand: 'VISA' | 'MASTERCARD' | 'OTHER';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  issuingCountry: string | null;
  funding: 'CREDIT' | 'DEBIT' | 'PREPAID' | 'UNKNOWN';
  currency: string | null;
  fingerprint: string | null;
  binPrefix: string | null;
  cardholderName: string | null;
  threeDsVerified: boolean;
}

export type CardSetupResult =
  | { status: 'PENDING' }
  | { status: 'FAILED'; reason: string }
  | { status: 'SUCCEEDED'; card: ProviderCardDetails };

export type PayeeLookupResult =
  { status: 'FOUND'; registeredName: string } | { status: 'NOT_FOUND' } | { status: 'INACTIVE' };

export interface PayeeRef {
  network: 'MTN';
  identifierType: 'PHONE' | 'MERCHANT_CODE';
  /** E.164 for phones, digits for merchant codes. */
  identifier: string;
}

export type AuthorisationResult =
  | { status: 'AUTHORISED'; providerRef: string }
  | { status: 'REQUIRES_ACTION'; providerRef: string; actionUrl: string }
  | { status: 'PENDING'; providerRef: string }
  | { status: 'DECLINED'; providerRef: string | null; declineCode: string }
  | { status: 'CANCELLED'; providerRef: string }
  | { status: 'NOT_FOUND' };

export type OperationResult =
  | { status: 'SUCCEEDED'; providerRef: string }
  | { status: 'PENDING'; providerRef: string | null }
  | { status: 'FAILED'; providerRef: string | null; failureCode: string }
  | { status: 'NOT_FOUND' };

export type PayoutResult =
  | { status: 'PENDING'; providerRef: string | null; raw: string }
  | { status: 'SUCCEEDED'; providerRef: string | null; raw: string }
  | { status: 'FAILED'; providerRef: string | null; raw: string; failureCode: string }
  | { status: 'REVERSED'; providerRef: string | null; raw: string }
  | { status: 'UNKNOWN'; providerRef: string | null; raw: string }
  | { status: 'NOT_FOUND' };

export interface AuthoriseRequest {
  requestRef: string;
  cardToken: string;
  amountMinor: bigint;
  currency: string;
  requireThreeDs: boolean;
  returnUrl: string;
}

export interface MoneyOperationRequest {
  requestRef: string;
  providerAuthRef: string;
  amountMinor: bigint;
  currency: string;
}

export interface PayoutRequest {
  requestRef: string;
  payee: PayeeRef;
  /** 0788123456: national format required by MoMo payout APIs. */
  localMsisdn: string | null;
  recipientName: string;
  amountRwf: bigint;
}

export interface PaymentProvider {
  readonly name: string;
  /** True only for the mock: every record it produces is flagged as simulated. */
  readonly simulated: boolean;
  /** What this adapter actually implements. Usability also requires approval (see ProviderGateway). */
  readonly implemented: ReadonlySet<ProviderCapability>;

  /**
   * For adapters that mix simulated and real operations (the hybrid): whether this capability
   * is simulated. Defaults to `simulated` for the whole adapter.
   */
  isSimulatedCapability?(capability: ProviderCapability): boolean;

  createCardSetup(input: {
    setupRef: string;
    customerCountry: string | null;
    returnUrl: string;
  }): Promise<{
    providerSetupId: string;
    hostedUrl: string;
    expiresAt: Date;
  }>;
  getCardSetupResult(providerSetupId: string): Promise<CardSetupResult>;
  lookupPayee(payee: PayeeRef): Promise<PayeeLookupResult>;
  authorise(request: AuthoriseRequest): Promise<AuthorisationResult>;
  getAuthorisation(requestRef: string): Promise<AuthorisationResult>;
  capture(request: MoneyOperationRequest): Promise<OperationResult>;
  getCapture(requestRef: string): Promise<OperationResult>;
  void(request: MoneyOperationRequest): Promise<OperationResult>;
  getVoid(requestRef: string): Promise<OperationResult>;
  refund(request: MoneyOperationRequest): Promise<OperationResult>;
  payout(request: PayoutRequest): Promise<PayoutResult>;
  getPayoutStatus(requestRef: string): Promise<PayoutResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
