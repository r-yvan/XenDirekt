import type { PaymentState } from '../../../database/schema';

/**
 * The payment state machine (docs/payment-state-machine.md, ADR 0007). Every state change goes
 * through `assertTransition`; the table below is the single source of truth and is exhaustively
 * unit-tested. PRD states keep their PRD meaning; CAPTURE_PENDING, CAPTURE_FAILED and VOID_PENDING
 * are the internal additions.
 */
export const TRANSITIONS: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  QUOTED: ['AUTH_PENDING', 'AUTH_FAILED'],
  AUTH_PENDING: ['AUTHORISED', 'AUTH_FAILED', 'VOID_PENDING', 'PENDING_REVIEW'],
  AUTHORISED: ['PAYOUT_PENDING', 'PENDING_REVIEW', 'VOID_PENDING'],
  PAYOUT_PENDING: ['CAPTURE_PENDING', 'PAYOUT_FAILED', 'PENDING_REVIEW'],
  PAYOUT_FAILED: ['VOID_PENDING'],
  // AUTH_FAILED: the hold being released never completed (3-D Secure abandoned, PRD §6).
  VOID_PENDING: ['VOIDED', 'AUTH_FAILED', 'PENDING_REVIEW'],
  // Payout confirmed: money reached the merchant. Never another payout from here.
  CAPTURE_PENDING: ['COMPLETED', 'CAPTURE_FAILED', 'PENDING_REVIEW'],
  CAPTURE_FAILED: ['CAPTURE_PENDING'],
  PENDING_REVIEW: [
    'AUTHORISED',
    'CAPTURE_PENDING',
    'VOID_PENDING',
    'AUTH_FAILED',
    'COMPLETED',
    'VOIDED',
  ],
  COMPLETED: ['REFUNDED'],
  AUTH_FAILED: [],
  VOIDED: [],
  REFUNDED: [],
};

export const ALL_STATES = Object.keys(TRANSITIONS) as PaymentState[];

/** Terminal for the original payment (COMPLETED can still become REFUNDED via operations). */
export const FINAL_STATES: readonly PaymentState[] = [
  'AUTH_FAILED',
  'VOIDED',
  'COMPLETED',
  'REFUNDED',
];

export function isFinal(state: PaymentState): boolean {
  return FINAL_STATES.includes(state);
}

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  return TRANSITIONS[from].includes(to);
}

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: PaymentState,
    readonly to: PaymentState,
  ) {
    super(`Illegal payment transition ${from} → ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

export function assertTransition(from: PaymentState, to: PaymentState): void {
  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

/** Why a payment is in PENDING_REVIEW. */
export type ReviewReason =
  | 'RISK_HOLD'
  | 'NO_FINAL_STATE_2MIN'
  | 'AUTH_OUTCOME_UNKNOWN'
  | 'PAYOUT_OUTCOME_UNKNOWN'
  | 'CAPTURE_OUTCOME_UNKNOWN'
  | 'VOID_FAILED'
  | 'PAYOUT_REVERSED_AFTER_SUCCESS';

/** Timestamp column stamped when a payment enters each state. */
export const STATE_TIMESTAMP: Partial<Record<PaymentState, string>> = {
  AUTH_PENDING: 'auth_pending_at',
  AUTHORISED: 'authorised_at',
  PAYOUT_PENDING: 'payout_pending_at',
  CAPTURE_PENDING: 'payout_confirmed_at',
  COMPLETED: 'completed_at',
  AUTH_FAILED: 'failed_at',
  PAYOUT_FAILED: 'failed_at',
  VOIDED: 'voided_at',
  PENDING_REVIEW: 'review_at',
  REFUNDED: 'refunded_at',
};
