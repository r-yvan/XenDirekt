import { ProviderCapability } from '../domain/capabilities';
import {
  AuthorisationResult,
  CardSetupResult,
  OperationResult,
  PayeeLookupResult,
  PaymentProvider,
  PayoutRequest,
  PayoutResult,
} from '../domain/payment-provider';
import {
  CapabilityNotConfiguredError,
  ProviderOutcomeUnknownError,
} from '../domain/provider-errors';
import { XentriPayHttpClient } from './xentripay-http.client';
import {
  mapPayoutStatus,
  payoutInitiationResponseSchema,
  payoutStatusResponseSchema,
} from './xentripay.mapping';

/** MTN MOBILE MONEY provider ID (XP §6). Airtel is out of scope and deliberately absent. */
export const XENTRIPAY_MTN_PROVIDER_ID = '63510';

/**
 * Implements ONLY what the supplied XentriPay documentation confirms (ADR 0004):
 *   - POST /api/payment-requests (payout initiation, XP §5.2)
 *   - GET  /api/payment-requests/check-status?customerRef= (payout status, XP §5.3)
 * Payouts additionally need a per-payout OTP approval by a business user (XP §5.1), so
 * PAYOUT_MTN_PHONE stays unusable until approved with evidence (OQ-13).
 * Collections and checkout are deliberately not used: they charge immediately and pull money
 * in the opposite direction. Every other operation raises CapabilityNotConfiguredError.
 */
export class XentriPayPaymentProvider implements PaymentProvider {
  readonly name = 'xentripay';
  readonly simulated = false;
  readonly implemented: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
    'PAYOUT_MTN_PHONE',
    'PAYOUT_STATUS',
  ]);

  constructor(private readonly http: XentriPayHttpClient) {}

  createCardSetup(): Promise<{ providerSetupId: string; hostedUrl: string; expiresAt: Date }> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_SETUP_TOKENISATION'));
  }

  getCardSetupResult(): Promise<CardSetupResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_SETUP_TOKENISATION'));
  }

  lookupPayee(): Promise<PayeeLookupResult> {
    // validatedAccountName only exists after a payout is initiated; never use that as a lookup.
    return Promise.reject(new CapabilityNotConfiguredError('PAYEE_NAME_LOOKUP_MTN'));
  }

  authorise(): Promise<AuthorisationResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_AUTHORISE'));
  }

  getAuthorisation(): Promise<AuthorisationResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_AUTHORISE'));
  }

  capture(): Promise<OperationResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_CAPTURE'));
  }

  getCapture(): Promise<OperationResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_CAPTURE'));
  }

  void(): Promise<OperationResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_VOID'));
  }

  getVoid(): Promise<OperationResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_VOID'));
  }

  refund(): Promise<OperationResult> {
    return Promise.reject(new CapabilityNotConfiguredError('CARD_REFUND'));
  }

  async payout(request: PayoutRequest): Promise<PayoutResult> {
    if (request.payee.identifierType !== 'PHONE' || !request.localMsisdn) {
      throw new CapabilityNotConfiguredError('PAYOUT_MTN_MERCHANT_CODE');
    }
    const amount = Number(request.amountRwf);
    if (!Number.isSafeInteger(amount)) {
      throw new Error('Payout amount out of range');
    }
    const { json } = await this.http.request('POST', '/api/payment-requests', {
      customerReference: request.requestRef,
      telecomProviderId: XENTRIPAY_MTN_PROVIDER_ID,
      msisdn: request.localMsisdn,
      name: request.recipientName,
      transactionType: 'PAYOUT',
      currency: 'RWF',
      amount,
    });
    const parsed = payoutInitiationResponseSchema.safeParse(json);
    if (!parsed.success || parsed.data.customerReference !== request.requestRef) {
      // A 2xx we cannot interpret may still mean the payout was accepted.
      throw new ProviderOutcomeUnknownError('Unrecognised XentriPay payout response');
    }
    return mapPayoutStatus(
      parsed.data.status,
      parsed.data.internalRef ?? parsed.data.externalTransactionRef ?? null,
    );
  }

  async getPayoutStatus(requestRef: string): Promise<PayoutResult> {
    const { status, json } = await this.http.request(
      'GET',
      `/api/payment-requests/check-status?customerRef=${encodeURIComponent(requestRef)}`,
    );
    if (status === 404) {
      // Undocumented (OQ-19): the orchestrator treats NOT_FOUND as ambiguous, never as "safe to resend".
      return { status: 'NOT_FOUND' };
    }
    const parsed = payoutStatusResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ProviderOutcomeUnknownError('Unrecognised XentriPay status response');
    }
    return mapPayoutStatus(parsed.data.data.status, parsed.data.data.reference_number ?? null);
  }
}
