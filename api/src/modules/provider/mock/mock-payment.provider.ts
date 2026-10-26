import { randomUUID } from 'node:crypto';
import { ProviderCapability, PROVIDER_CAPABILITIES } from '../domain/capabilities';
import {
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
import { ProviderOutcomeUnknownError, ProviderUnreachableError } from '../domain/provider-errors';
import {
  COUNTRY_CURRENCY,
  MOCK_CARDS,
  MockCard,
  payeeBehaviour,
  sandboxPayeeName,
} from './mock-scenarios';

interface MockSetup {
  id: string;
  customerCountry: string | null;
  returnUrl: string;
  expiresAt: Date;
  result: CardSetupResult;
}

interface MockAuth {
  requestRef: string;
  providerRef: string;
  card: MockCard;
  status: 'AUTHORISED' | 'REQUIRES_ACTION' | 'DECLINED' | 'CANCELLED';
  declineCode?: string;
  returnUrl: string;
  amountMinor: bigint;
}

interface MockPayout {
  requestRef: string;
  providerRef: string;
  behaviour: ReturnType<typeof payeeBehaviour>;
  checks: number;
}

/**
 * Local/test provider (never production: startup guards and ProviderGateway both refuse).
 * State is in memory, so run with WORKER_MODE=inline (one process). Hosted pages for card setup
 * and 3-D Secure are served by MockProviderPagesController under /dev/mock-provider.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly simulated = true;
  readonly implemented: ReadonlySet<ProviderCapability> = new Set(PROVIDER_CAPABILITIES);

  private readonly setups = new Map<string, MockSetup>();
  private readonly tokens = new Map<string, MockCard>();
  private readonly auths = new Map<string, MockAuth>();
  private readonly payouts = new Map<string, MockPayout>();
  private readonly operations = new Map<string, OperationResult>();

  constructor(
    private readonly publicBaseUrl: string,
    private readonly latencyMs = 0,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // --- card setup (hosted page) -------------------------------------------------------------

  async createCardSetup(input: {
    setupRef: string;
    customerCountry: string | null;
    returnUrl: string;
  }) {
    await this.delay();
    const id = `mock_setup_${randomUUID()}`;
    const expiresAt = new Date(this.now().getTime() + 15 * 60_000);
    this.setups.set(id, {
      id,
      customerCountry: input.customerCountry,
      returnUrl: input.returnUrl,
      expiresAt,
      result: { status: 'PENDING' },
    });
    return {
      providerSetupId: id,
      hostedUrl: `${this.publicBaseUrl}/dev/mock-provider/card-setup/${id}`,
      expiresAt,
    };
  }

  async getCardSetupResult(providerSetupId: string): Promise<CardSetupResult> {
    await this.delay();
    return (
      this.setups.get(providerSetupId)?.result ?? { status: 'FAILED', reason: 'UNKNOWN_SETUP' }
    );
  }

  /** Called by the hosted mock page when the tester picks a card. Returns the redirect URL. */
  completeSetup(providerSetupId: string, cardKey: string): string | null {
    const setup = this.setups.get(providerSetupId);
    const card = MOCK_CARDS.find((candidate) => candidate.key === cardKey);
    if (!setup || !card || setup.expiresAt < this.now()) {
      return null;
    }
    if (card.behaviour === 'SETUP_FAILS') {
      setup.result = { status: 'FAILED', reason: 'THREE_DS_FAILED' };
    } else {
      const token = `mock_tok_${randomUUID()}`;
      this.tokens.set(token, card);
      const country = card.issuingCountry ?? setup.customerCountry ?? 'US';
      setup.result = {
        status: 'SUCCEEDED',
        card: {
          token,
          brand: card.brand,
          last4: card.last4,
          expiryMonth: 12,
          expiryYear: this.now().getUTCFullYear() + 3,
          issuingCountry: country,
          funding: card.funding,
          currency: card.currency ?? COUNTRY_CURRENCY[country] ?? 'USD',
          fingerprint: `mockfp_${card.key}`,
          binPrefix: card.brand === 'VISA' ? '424242' : '555555',
          cardholderName: null,
          threeDsVerified: true,
        },
      };
    }
    return `${setup.returnUrl}${setup.returnUrl.includes('?') ? '&' : '?'}setupId=${encodeURIComponent(providerSetupId)}`;
  }

  setupSummary(providerSetupId: string): { open: boolean } {
    const setup = this.setups.get(providerSetupId);
    return {
      open: Boolean(setup && setup.result.status === 'PENDING' && setup.expiresAt > this.now()),
    };
  }

  // --- payee lookup ---------------------------------------------------------------------------

  async lookupPayee(payee: PayeeRef): Promise<PayeeLookupResult> {
    await this.delay();
    switch (payeeBehaviour(payee.identifier)) {
      case 'NOT_FOUND':
        return { status: 'NOT_FOUND' };
      case 'INACTIVE':
        return { status: 'INACTIVE' };
      case 'LOOKUP_DOWN':
        throw new ProviderUnreachableError('Mock lookup unavailable');
      default:
        return { status: 'FOUND', registeredName: sandboxPayeeName(payee.identifier) };
    }
  }

  // --- card authorisation / capture / void / refund -------------------------------------------

  async authorise(request: AuthoriseRequest): Promise<AuthorisationResult> {
    await this.delay();
    const existing = this.auths.get(request.requestRef);
    if (existing) {
      return this.authView(existing);
    }
    const card = this.tokens.get(request.cardToken);
    const providerRef = `mock_auth_${randomUUID()}`;
    if (!card) {
      return { status: 'DECLINED', providerRef, declineCode: 'INVALID_TOKEN' };
    }
    const auth: MockAuth = {
      requestRef: request.requestRef,
      providerRef,
      card,
      status: 'AUTHORISED',
      returnUrl: request.returnUrl,
      amountMinor: request.amountMinor,
    };
    if (card.behaviour === 'DECLINE') {
      auth.status = 'DECLINED';
      auth.declineCode = 'DO_NOT_HONOUR';
    } else if (request.requireThreeDs || card.behaviour === 'ALWAYS_3DS') {
      auth.status = 'REQUIRES_ACTION';
    }
    this.auths.set(request.requestRef, auth);
    return this.authView(auth);
  }

  async getAuthorisation(requestRef: string): Promise<AuthorisationResult> {
    await this.delay();
    const auth = this.auths.get(requestRef);
    return auth ? this.authView(auth) : { status: 'NOT_FOUND' };
  }

  /** Called by the hosted 3-D Secure page. Returns the return URL. */
  completeThreeDs(providerRef: string, approve: boolean): string | null {
    const auth = [...this.auths.values()].find(
      (candidate) => candidate.providerRef === providerRef,
    );
    if (!auth || auth.status !== 'REQUIRES_ACTION') {
      return null;
    }
    auth.status = approve ? 'AUTHORISED' : 'DECLINED';
    auth.declineCode = approve ? undefined : 'THREE_DS_FAILED';
    return auth.returnUrl;
  }

  threeDsSummary(providerRef: string): { open: boolean; amountMinor: bigint | null } {
    const auth = [...this.auths.values()].find(
      (candidate) => candidate.providerRef === providerRef,
    );
    return { open: auth?.status === 'REQUIRES_ACTION', amountMinor: auth?.amountMinor ?? null };
  }

  async capture(request: MoneyOperationRequest): Promise<OperationResult> {
    await this.delay();
    const auth = [...this.auths.values()].find(
      (candidate) => candidate.providerRef === request.providerAuthRef,
    );
    const result: OperationResult =
      !auth || auth.status !== 'AUTHORISED'
        ? { status: 'FAILED', providerRef: null, failureCode: 'NO_AUTHORISATION' }
        : auth.card.behaviour === 'CAPTURE_FAILS'
          ? { status: 'FAILED', providerRef: null, failureCode: 'CAPTURE_DECLINED' }
          : { status: 'SUCCEEDED', providerRef: `mock_cap_${randomUUID()}` };
    this.operations.set(request.requestRef, result);
    return result;
  }

  async getCapture(requestRef: string): Promise<OperationResult> {
    await this.delay();
    return this.operations.get(requestRef) ?? { status: 'NOT_FOUND' };
  }

  async void(request: MoneyOperationRequest): Promise<OperationResult> {
    await this.delay();
    const auth = [...this.auths.values()].find(
      (candidate) => candidate.providerRef === request.providerAuthRef,
    );
    if (auth && (auth.status === 'AUTHORISED' || auth.status === 'REQUIRES_ACTION')) {
      auth.status = 'CANCELLED';
    }
    const result: OperationResult = {
      status: 'SUCCEEDED',
      providerRef: `mock_void_${randomUUID()}`,
    };
    this.operations.set(request.requestRef, result);
    return result;
  }

  async getVoid(requestRef: string): Promise<OperationResult> {
    await this.delay();
    return this.operations.get(requestRef) ?? { status: 'NOT_FOUND' };
  }

  async refund(request: MoneyOperationRequest): Promise<OperationResult> {
    await this.delay();
    const result: OperationResult = {
      status: 'SUCCEEDED',
      providerRef: `mock_refund_${randomUUID()}`,
    };
    this.operations.set(request.requestRef, result);
    return result;
  }

  // --- payouts ---------------------------------------------------------------------------------

  async payout(request: PayoutRequest): Promise<PayoutResult> {
    await this.delay();
    const existing = this.payouts.get(request.requestRef);
    if (existing) {
      // Partner-side idempotency on the client reference: never a second transfer.
      return this.payoutView(existing);
    }
    const payout: MockPayout = {
      requestRef: request.requestRef,
      providerRef: `mock_payout_${randomUUID()}`,
      behaviour: payeeBehaviour(request.payee.identifier),
      checks: 0,
    };
    this.payouts.set(request.requestRef, payout);
    if (payout.behaviour === 'PAYOUT_TIMEOUT') {
      // Accepted and completed at the "provider", but the response never reaches us.
      throw new ProviderOutcomeUnknownError('Mock payout response timed out');
    }
    return { status: 'PENDING', providerRef: payout.providerRef, raw: 'PENDING' };
  }

  async getPayoutStatus(requestRef: string): Promise<PayoutResult> {
    await this.delay();
    const payout = this.payouts.get(requestRef);
    if (!payout) {
      return { status: 'NOT_FOUND' };
    }
    payout.checks += 1;
    return this.payoutView(payout);
  }

  /** Test hook: forget all simulated state (tests reset the database between cases). */
  reset(): void {
    this.setups.clear();
    this.tokens.clear();
    this.auths.clear();
    this.payouts.clear();
    this.operations.clear();
  }

  /** Test hook: how many payouts were ever created (never more than one per payment). */
  payoutCount(): number {
    return this.payouts.size;
  }

  private payoutView(payout: MockPayout): PayoutResult {
    switch (payout.behaviour) {
      case 'PAYOUT_FAILS':
        return {
          status: 'FAILED',
          providerRef: payout.providerRef,
          raw: 'FAILED',
          failureCode: 'ACCOUNT_REJECTED',
        };
      case 'PAYOUT_STUCK':
        return { status: 'PENDING', providerRef: payout.providerRef, raw: 'PENDING' };
      case 'PAYOUT_REVERSED':
        return payout.checks > 1
          ? { status: 'REVERSED', providerRef: payout.providerRef, raw: 'REVERSED' }
          : { status: 'SUCCEEDED', providerRef: payout.providerRef, raw: 'COMPLETED' };
      default:
        return payout.checks === 0
          ? { status: 'PENDING', providerRef: payout.providerRef, raw: 'PENDING' }
          : { status: 'SUCCEEDED', providerRef: payout.providerRef, raw: 'COMPLETED' };
    }
  }

  private authView(auth: MockAuth): AuthorisationResult {
    switch (auth.status) {
      case 'AUTHORISED':
        return { status: 'AUTHORISED', providerRef: auth.providerRef };
      case 'REQUIRES_ACTION':
        return {
          status: 'REQUIRES_ACTION',
          providerRef: auth.providerRef,
          actionUrl: `${this.publicBaseUrl}/dev/mock-provider/3ds/${auth.providerRef}`,
        };
      case 'CANCELLED':
        return { status: 'CANCELLED', providerRef: auth.providerRef };
      default:
        return {
          status: 'DECLINED',
          providerRef: auth.providerRef,
          declineCode: auth.declineCode ?? 'DECLINED',
        };
    }
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
  }
}
