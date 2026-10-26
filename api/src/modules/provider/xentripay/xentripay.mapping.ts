import { z } from 'zod';
import { PayoutResult } from '../domain/payment-provider';

/**
 * Payout status normalisation (XentriPay docs §5.4; docs/provider-capability-matrix.md).
 * PENDING is acceptance only; only COMPLETED / SUCCESSFUL mean the payout is final.
 * Anything unrecognised is UNKNOWN, which the orchestrator routes to review: never success.
 */
export function mapPayoutStatus(
  raw: string | null | undefined,
  providerRef: string | null,
): PayoutResult {
  const value = (raw ?? '').trim().toUpperCase();
  switch (value) {
    case 'PENDING':
      return { status: 'PENDING', providerRef, raw: value };
    case 'COMPLETED':
    case 'SUCCESSFUL':
      return { status: 'SUCCEEDED', providerRef, raw: value };
    case 'FAILED':
      return { status: 'FAILED', providerRef, raw: value, failureCode: 'PROVIDER_FAILED' };
    case 'REVERSED':
      return { status: 'REVERSED', providerRef, raw: value };
    default:
      return { status: 'UNKNOWN', providerRef, raw: value.slice(0, 40) || 'EMPTY' };
  }
}

/** XP §5.2 sample response; fields we rely on are required, the rest optional. */
export const payoutInitiationResponseSchema = z.looseObject({
  customerReference: z.string(),
  status: z.string(),
  internalRef: z.string().nullish(),
  externalTransactionRef: z.string().nullish(),
  telecomProviderId: z.string().nullish(),
  amount: z.union([z.number(), z.string()]).nullish(),
});

/** XP §5.3 sample response. */
export const payoutStatusResponseSchema = z.looseObject({
  message: z.string().nullish(),
  data: z.looseObject({
    status: z.string(),
    reference_number: z.string().nullish(),
    amount: z.union([z.number(), z.string()]).nullish(),
  }),
});
