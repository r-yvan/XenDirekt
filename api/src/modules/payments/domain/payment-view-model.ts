import type { PaymentState } from '../../../database/schema';
import type { ReviewReason } from './payment-state-machine';

/**
 * What the tourist sees (PRD FR-EXE-04: Processing → Sent → Received) and, always, whether they
 * were charged (PRD §9 tone of copy). Internal states map onto these user-facing fields.
 */
export type UserStatus =
  | 'PROCESSING'
  | 'ACTION_REQUIRED'
  | 'SENT'
  | 'RECEIVED'
  | 'COMPLETED'
  | 'FAILED'
  | 'IN_REVIEW'
  | 'REFUNDED';
export type ChargeStatus =
  'NOT_CHARGED' | 'HOLD' | 'HOLD_RELEASING' | 'CHARGED' | 'REFUNDED' | 'UNKNOWN';

export interface UserFacingStatus {
  status: UserStatus;
  chargeStatus: ChargeStatus;
  /** Stable reason code the app maps to copy; null unless FAILED. */
  failureReason: string | null;
  steps: { processing: boolean; sent: boolean; received: boolean };
}

export function userFacingStatus(
  state: PaymentState,
  options: {
    hasNextAction: boolean;
    failureCode: string | null;
    reviewReason: ReviewReason | null;
  },
): UserFacingStatus {
  const steps = (processing: boolean, sent: boolean, received: boolean) => ({
    processing,
    sent,
    received,
  });
  switch (state) {
    case 'QUOTED':
      return {
        status: 'PROCESSING',
        chargeStatus: 'NOT_CHARGED',
        failureReason: null,
        steps: steps(false, false, false),
      };
    case 'AUTH_PENDING':
      return {
        status: options.hasNextAction ? 'ACTION_REQUIRED' : 'PROCESSING',
        chargeStatus: 'NOT_CHARGED',
        failureReason: null,
        steps: steps(false, false, false),
      };
    case 'AUTHORISED':
      return {
        status: 'PROCESSING',
        chargeStatus: 'HOLD',
        failureReason: null,
        steps: steps(true, false, false),
      };
    case 'PAYOUT_PENDING':
      return {
        status: 'SENT',
        chargeStatus: 'HOLD',
        failureReason: null,
        steps: steps(true, true, false),
      };
    case 'CAPTURE_PENDING':
      return {
        status: 'RECEIVED',
        chargeStatus: 'HOLD',
        failureReason: null,
        steps: steps(true, true, true),
      };
    case 'COMPLETED':
      return {
        status: 'COMPLETED',
        chargeStatus: 'CHARGED',
        failureReason: null,
        steps: steps(true, true, true),
      };
    case 'AUTH_FAILED':
      return {
        status: 'FAILED',
        chargeStatus: 'NOT_CHARGED',
        failureReason: options.failureCode ?? 'CARD_DECLINED',
        steps: steps(false, false, false),
      };
    case 'PAYOUT_FAILED':
    case 'VOID_PENDING':
      return {
        status: 'FAILED',
        chargeStatus: 'HOLD_RELEASING',
        failureReason: options.failureCode ?? 'PAYOUT_FAILED',
        steps: steps(true, false, false),
      };
    case 'VOIDED':
      return {
        status: 'FAILED',
        chargeStatus: 'NOT_CHARGED',
        failureReason: options.failureCode ?? 'PAYOUT_FAILED',
        steps: steps(true, false, false),
      };
    case 'CAPTURE_FAILED':
      // The merchant was paid; operations resolve the card side. Never shown as a failure.
      return {
        status: 'IN_REVIEW',
        chargeStatus: 'UNKNOWN',
        failureReason: null,
        steps: steps(true, true, true),
      };
    case 'PENDING_REVIEW':
      return {
        status: 'IN_REVIEW',
        chargeStatus: options.reviewReason === 'RISK_HOLD' ? 'HOLD' : 'UNKNOWN',
        failureReason: null,
        steps: steps(true, options.reviewReason !== 'RISK_HOLD', false),
      };
    case 'REFUNDED':
      return {
        status: 'REFUNDED',
        chargeStatus: 'REFUNDED',
        failureReason: null,
        steps: steps(true, true, true),
      };
  }
}
