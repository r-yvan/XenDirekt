import { formatMoneyForDisplay } from '../../../shared/money/currency';
import { formatRate, parseRate } from '../../../shared/money/fx';
import { toSafeNumber } from '../../../shared/money/money';
import { displayRate } from '../../quotes/domain/quote-calculator';
import type { ReturnChannel } from '../../../database/schema';
import type { ReviewReason } from '../domain/payment-state-machine';
import { userFacingStatus } from '../domain/payment-view-model';
import type { PaymentRow } from './payment-transitions.service';

export const THREE_DS_RETURN_PREFIX = 'xendirekt-app://3ds/return';
/** Web portal page that 3-D Secure returns to for payments made on the web. */
export const WEB_THREE_DS_RETURN_PATH = '/app/payments/return';

/** Where the issuer's 3-D Secure page sends the payer back to: the app or the web portal. */
export function threeDsReturnPrefix(channel: ReturnChannel, webBaseUrl: string): string {
  return channel === 'WEB' ? `${webBaseUrl}${WEB_THREE_DS_RETURN_PATH}` : THREE_DS_RETURN_PREFIX;
}

/** Kigali is UTC+02:00 with no daylight saving. */
function kigaliIso(date: Date | null): string | null {
  if (!date) {
    return null;
  }
  return `${new Date(date.getTime() + 2 * 3_600_000).toISOString().slice(0, 19)}+02:00`;
}

/**
 * The public payment representation (contracts/fixtures/payment_*.json). `webBaseUrl` makes the
 * 3-D Secure return prefix absolute for web payments.
 */
export function paymentView(row: PaymentRow, webBaseUrl = '') {
  const status = userFacingStatus(row.state, {
    hasNextAction: row.next_action_url !== null,
    failureCode: row.failure_code,
    reviewReason: row.review_reason as ReviewReason | null,
  });
  const rate = formatRate(parseRate(row.fx_rate));
  const completed = row.state === 'COMPLETED' || row.state === 'REFUNDED';
  return {
    id: row.id,
    reference: row.reference,
    state: row.state,
    status: status.status,
    chargeStatus: status.chargeStatus,
    failureReason: status.failureReason,
    steps: status.steps,
    nextAction:
      row.state === 'AUTH_PENDING' && row.next_action_url
        ? {
            type: 'THREE_DS' as const,
            url: row.next_action_url,
            returnUrlPrefix: threeDsReturnPrefix(row.return_channel, webBaseUrl),
          }
        : null,
    amountRwf: toSafeNumber(row.amount_rwf),
    feeRwf: toSafeNumber(row.fee_rwf),
    totalRwf: toSafeNumber(row.total_rwf),
    cardCurrency: row.card_currency,
    totalCardMinor: toSafeNumber(row.total_card_minor),
    totalCardDisplay: formatMoneyForDisplay(row.total_card_minor, row.card_currency),
    fxRate: rate,
    fxRateDisplay: displayRate(row.card_currency, rate),
    payee: {
      registeredName: row.payee_name_snapshot,
      maskedIdentifier: row.payee_identifier_masked,
    },
    card: { brand: row.card_brand_snapshot, last4: row.card_last4_snapshot },
    note: row.note,
    simulated: row.is_simulated,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
    receipt: completed
      ? {
          reference: row.reference,
          kigaliDateTime: kigaliIso(row.completed_at),
          merchantName: row.payee_name_snapshot,
          merchantIdentifier: row.payee_identifier_masked,
          amountRwf: toSafeNumber(row.amount_rwf),
          feeRwf: toSafeNumber(row.fee_rwf),
          fxRateDisplay: displayRate(row.card_currency, rate),
          totalCardDisplay: formatMoneyForDisplay(row.total_card_minor, row.card_currency),
          card: `${row.card_brand_snapshot} •••• ${row.card_last4_snapshot}`,
          status: status.status,
          simulated: row.is_simulated,
        }
      : null,
  };
}

export type PaymentView = ReturnType<typeof paymentView>;
