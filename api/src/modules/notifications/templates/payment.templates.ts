import { formatMoneyForDisplay } from '../../../shared/money/currency';
import type { Locale } from './otp.template';

export type PaymentNotificationKind = 'COMPLETED' | 'FAILED' | 'VOIDED' | 'IN_REVIEW' | 'REFUNDED';

export interface PaymentMessageData {
  reference: string;
  amountRwf: bigint;
  totalCardMinor: bigint;
  cardCurrency: string;
  merchantName: string;
  payerFirstName: string | null;
  note: string | null;
  simulated: boolean;
}

const SANDBOX = { en: '[SANDBOX: not real money] ', fr: '[BAC À SABLE : pas de vrai argent] ' };

/** Tourist copy (in-app, push, email, SMS). Always says whether they were charged (PRD §9). */
export function touristMessage(
  kind: PaymentNotificationKind,
  locale: Locale,
  data: PaymentMessageData,
): { title: string; body: string } {
  const rwf = formatMoneyForDisplay(data.amountRwf, 'RWF');
  const card = formatMoneyForDisplay(data.totalCardMinor, data.cardCurrency);
  const prefix = data.simulated ? SANDBOX[locale] : '';
  const fr = locale === 'fr';
  const copy: Record<PaymentNotificationKind, { title: string; body: string }> = fr
    ? {
        COMPLETED: {
          title: 'Paiement envoyé',
          body: `${data.merchantName} a reçu ${rwf}. Réf. ${data.reference}.`,
        },
        FAILED: {
          title: 'Paiement non effectué',
          body: `Vous n'avez pas été débité. Réf. ${data.reference}.`,
        },
        VOIDED: {
          title: 'Paiement non effectué',
          body: `Le compte MoMo du vendeur n'a pas pu recevoir ce paiement. Vous n'avez pas été débité. Réf. ${data.reference}.`,
        },
        IN_REVIEW: {
          title: 'Paiement en vérification',
          body: `Nous vous informerons dans les 30 minutes. Réf. ${data.reference}.`,
        },
        REFUNDED: {
          title: 'Paiement remboursé',
          body: `${card} vous est remboursé. Réf. ${data.reference}.`,
        },
      }
    : {
        COMPLETED: {
          title: 'Payment sent',
          body: `${data.merchantName} received ${rwf}. Ref ${data.reference}.`,
        },
        FAILED: {
          title: 'Payment not completed',
          body: `You were not charged. Ref ${data.reference}.`,
        },
        VOIDED: {
          title: 'Payment not completed',
          body: `The seller's MoMo couldn't receive this payment. You have not been charged. Ref ${data.reference}.`,
        },
        IN_REVIEW: {
          title: 'Payment being checked',
          body: `We'll notify you within 30 minutes. Ref ${data.reference}.`,
        },
        REFUNDED: {
          title: 'Payment refunded',
          body: `${card} is being returned to your card. Ref ${data.reference}.`,
        },
      };
  return { title: copy[kind].title, body: `${prefix}${copy[kind].body}` };
}

/**
 * Merchant SMS (FR-RCP-01), English followed by Kinyarwanda. The Kinyarwanda line is a draft
 * that MUST be reviewed by a native speaker before launch (docs/open-questions.md OQ-24).
 * Only the payer's first name is shared (OQ-32).
 */
export function merchantSms(data: PaymentMessageData): string {
  const rwf = formatMoneyForDisplay(data.amountRwf, 'RWF');
  const payer = data.payerFirstName ?? 'a visitor';
  const payerRw = data.payerFirstName ?? 'umushyitsi';
  const note = data.note ? ` Note: ${data.note}.` : '';
  const prefix = data.simulated ? '[SANDBOX: not real money] ' : '';
  return (
    `${prefix}You received ${rwf} from ${payer} via XenDirekt. Ref ${data.reference}.${note}\n` +
    `Wakiriye ${rwf} yohererejwe na ${payerRw} binyuze kuri XenDirekt. Ref ${data.reference}.`
  );
}
