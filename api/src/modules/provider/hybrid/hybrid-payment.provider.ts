import { PROVIDER_CAPABILITIES, type ProviderCapability } from '../domain/capabilities';
import type {
  AuthorisationResult,
  AuthoriseRequest,
  CardSetupResult,
  MoneyOperationRequest,
  OperationResult,
  PayeeLookupResult,
  PayeeRef,
  PaymentProvider,
  PayoutRequest,
  PayoutResult,
} from '../domain/payment-provider';
import type { MockPaymentProvider } from '../mock/mock-payment.provider';
import type { XentriPayPaymentProvider } from '../xentripay/xentripay-payment.provider';

/** The operations that go to XentriPay; everything else stays simulated. */
const REAL_CAPABILITIES: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
  'PAYOUT_MTN_PHONE',
  'PAYOUT_STATUS',
]);

/**
 * Local and staging testing only (`PAYMENT_PROVIDER=hybrid`): card setup, 3-D Secure,
 * authorise / capture / void / refund and the payee name lookup are SIMULATED by the mock,
 * because XentriPay documents none of them; payouts and payout status go to XentriPay (its
 * test environment by default). This lets the whole app flow run while the money-out leg is
 * exercised against XentriPay for real.
 *
 * Every payment it touches is still marked simulated (no real card money moves), and startup
 * refuses it in production like the mock. The real capabilities still need approval evidence
 * in PROVIDER_CAPABILITY_APPROVALS, as for any real provider.
 */
export class HybridPaymentProvider implements PaymentProvider {
  readonly name = 'hybrid-xentripay';
  readonly simulated = true;
  readonly implemented: ReadonlySet<ProviderCapability> = new Set(PROVIDER_CAPABILITIES);

  constructor(
    readonly mock: MockPaymentProvider,
    private readonly xentripay: XentriPayPaymentProvider,
  ) {}

  isSimulatedCapability(capability: ProviderCapability): boolean {
    return !REAL_CAPABILITIES.has(capability);
  }

  createCardSetup(input: {
    setupRef: string;
    customerCountry: string | null;
    returnUrl: string;
  }): Promise<{ providerSetupId: string; hostedUrl: string; expiresAt: Date }> {
    return this.mock.createCardSetup(input);
  }

  getCardSetupResult(providerSetupId: string): Promise<CardSetupResult> {
    return this.mock.getCardSetupResult(providerSetupId);
  }

  lookupPayee(payee: PayeeRef): Promise<PayeeLookupResult> {
    return this.mock.lookupPayee(payee);
  }

  authorise(request: AuthoriseRequest): Promise<AuthorisationResult> {
    return this.mock.authorise(request);
  }

  getAuthorisation(requestRef: string): Promise<AuthorisationResult> {
    return this.mock.getAuthorisation(requestRef);
  }

  capture(request: MoneyOperationRequest): Promise<OperationResult> {
    return this.mock.capture(request);
  }

  getCapture(requestRef: string): Promise<OperationResult> {
    return this.mock.getCapture(requestRef);
  }

  void(request: MoneyOperationRequest): Promise<OperationResult> {
    return this.mock.void(request);
  }

  getVoid(requestRef: string): Promise<OperationResult> {
    return this.mock.getVoid(requestRef);
  }

  refund(request: MoneyOperationRequest): Promise<OperationResult> {
    return this.mock.refund(request);
  }

  payout(request: PayoutRequest): Promise<PayoutResult> {
    return this.xentripay.payout(request);
  }

  getPayoutStatus(requestRef: string): Promise<PayoutResult> {
    return this.xentripay.getPayoutStatus(requestRef);
  }
}
