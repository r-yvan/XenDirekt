# ADR 0007: Payment state machine extensions and per-operation records

## Context

The PRD state list (§6) does not cover every recoverable situation. Two gaps matter: a payout
succeeds but the card capture fails, and a void is requested but not yet confirmed. The brief
requires a dedicated exception state for capture failure, and no second payout ever.

## Decision

- Keep every PRD state, with the same meaning, and add three internal states:
  - `CAPTURE_PENDING`: payout confirmed, capture requested. Not final.
  - `CAPTURE_FAILED`: payout confirmed, capture rejected. Not final; ops must resolve; a second
    payout is impossible.
  - `VOID_PENDING`: void requested after a payout failure or a review rejection. Not final.
- Record every provider call in `provider_operations` with its own request reference, provider
  reference, status and timestamps (types `AUTHORISATION`, `PAYOUT`, `CAPTURE`, `VOID`, `REFUND`).
- Enforce the money invariants in the database:
  - `UNIQUE (payment_id) WHERE type = 'PAYOUT'`: **at most one payout per payment, ever**;
  - one authorisation per payment;
  - at most one capture, void or refund per payment that is not failed.
- Every transition goes through a pure transition table (`domain/payment-state-machine.ts`),
  is persisted with optimistic versioning, and writes a `payment_events` row in the same
  transaction.
- `PENDING_REVIEW` keeps a `review_reason`. Ops actions are checked against the payment's
  financial position (the operation statuses), not only its state. For example, "confirm payout
  failed" is rejected if a payout has succeeded.

## Consequences

- No double payout, even under concurrent workers or replayed events.
- The app maps the extra internal states onto its three user-facing steps
  (Processing → Sent → Received) and always says whether the user was charged.
