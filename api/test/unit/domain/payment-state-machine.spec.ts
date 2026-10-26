import type { PaymentState } from '../../../src/database/schema';
import {
  ALL_STATES,
  assertTransition,
  canTransition,
  FINAL_STATES,
  IllegalTransitionError,
  isFinal,
  TRANSITIONS,
} from '../../../src/modules/payments/domain/payment-state-machine';
import { userFacingStatus } from '../../../src/modules/payments/domain/payment-view-model';

/** NFR-QA-01: every allowed AND every disallowed transition is asserted. */
const ALLOWED: [PaymentState, PaymentState][] = [
  ['QUOTED', 'AUTH_PENDING'],
  ['QUOTED', 'AUTH_FAILED'],
  ['AUTH_PENDING', 'AUTHORISED'],
  ['AUTH_PENDING', 'AUTH_FAILED'],
  ['AUTH_PENDING', 'VOID_PENDING'],
  ['AUTH_PENDING', 'PENDING_REVIEW'],
  ['AUTHORISED', 'PAYOUT_PENDING'],
  ['AUTHORISED', 'PENDING_REVIEW'],
  ['AUTHORISED', 'VOID_PENDING'],
  ['PAYOUT_PENDING', 'CAPTURE_PENDING'],
  ['PAYOUT_PENDING', 'PAYOUT_FAILED'],
  ['PAYOUT_PENDING', 'PENDING_REVIEW'],
  ['PAYOUT_FAILED', 'VOID_PENDING'],
  ['VOID_PENDING', 'VOIDED'],
  ['VOID_PENDING', 'AUTH_FAILED'],
  ['VOID_PENDING', 'PENDING_REVIEW'],
  ['CAPTURE_PENDING', 'COMPLETED'],
  ['CAPTURE_PENDING', 'CAPTURE_FAILED'],
  ['CAPTURE_PENDING', 'PENDING_REVIEW'],
  ['CAPTURE_FAILED', 'CAPTURE_PENDING'],
  ['PENDING_REVIEW', 'AUTHORISED'],
  ['PENDING_REVIEW', 'CAPTURE_PENDING'],
  ['PENDING_REVIEW', 'VOID_PENDING'],
  ['PENDING_REVIEW', 'AUTH_FAILED'],
  ['PENDING_REVIEW', 'COMPLETED'],
  ['PENDING_REVIEW', 'VOIDED'],
  ['COMPLETED', 'REFUNDED'],
];

const key = (from: PaymentState, to: PaymentState) => `${from}->${to}`;
const allowed = new Set(ALLOWED.map(([from, to]) => key(from, to)));
const everyPair = ALL_STATES.flatMap((from) =>
  ALL_STATES.map((to) => [from, to] as [PaymentState, PaymentState]),
);

describe('payment state machine', () => {
  it('declares all 13 states', () => {
    expect(ALL_STATES).toHaveLength(13);
  });

  it.each(ALLOWED)('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(everyPair.filter(([from, to]) => !allowed.has(key(from, to))))(
    'forbids %s → %s',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrow(IllegalTransitionError);
    },
  );

  it('the table contains exactly the documented edges', () => {
    const declared = Object.entries(TRANSITIONS).flatMap(([from, targets]) =>
      targets.map((to) => key(from as PaymentState, to)),
    );
    expect(declared.sort()).toEqual([...allowed].sort());
  });

  it('never leads back to a payout once the payout is confirmed', () => {
    for (const state of [
      'CAPTURE_PENDING',
      'CAPTURE_FAILED',
      'COMPLETED',
      'REFUNDED',
    ] as PaymentState[]) {
      expect(canTransition(state, 'PAYOUT_PENDING')).toBe(false);
      expect(canTransition(state, 'AUTHORISED')).toBe(false);
    }
  });

  it('final states have no exits except COMPLETED → REFUNDED', () => {
    expect(FINAL_STATES.every(isFinal)).toBe(true);
    expect(TRANSITIONS.AUTH_FAILED).toEqual([]);
    expect(TRANSITIONS.VOIDED).toEqual([]);
    expect(TRANSITIONS.REFUNDED).toEqual([]);
    expect(TRANSITIONS.COMPLETED).toEqual(['REFUNDED']);
    expect(isFinal('PENDING_REVIEW')).toBe(false);
    expect(isFinal('PAYOUT_FAILED')).toBe(false);
  });
});

describe('user-facing status', () => {
  const base = { hasNextAction: false, failureCode: null, reviewReason: null };

  it('always says whether the user was charged', () => {
    for (const state of ALL_STATES) {
      expect(userFacingStatus(state, base).chargeStatus).toBeDefined();
    }
    expect(userFacingStatus('VOIDED', base)).toMatchObject({
      status: 'FAILED',
      chargeStatus: 'NOT_CHARGED',
    });
    expect(
      userFacingStatus('AUTH_FAILED', { ...base, failureCode: 'THREE_DS_ABANDONED' }),
    ).toMatchObject({
      chargeStatus: 'NOT_CHARGED',
      failureReason: 'THREE_DS_ABANDONED',
    });
    expect(userFacingStatus('COMPLETED', base)).toMatchObject({
      status: 'COMPLETED',
      chargeStatus: 'CHARGED',
    });
  });

  it('maps internal progress onto Processing → Sent → Received', () => {
    expect(userFacingStatus('AUTH_PENDING', { ...base, hasNextAction: true }).status).toBe(
      'ACTION_REQUIRED',
    );
    expect(userFacingStatus('PAYOUT_PENDING', base).steps).toEqual({
      processing: true,
      sent: true,
      received: false,
    });
    expect(userFacingStatus('CAPTURE_PENDING', base).steps).toEqual({
      processing: true,
      sent: true,
      received: true,
    });
  });

  it('shows a capture failure as "being checked", never as a failed payment', () => {
    expect(userFacingStatus('CAPTURE_FAILED', base).status).toBe('IN_REVIEW');
  });
});
