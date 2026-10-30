# Refund failure or manual refund

**Signals:** `REFUND_FAILED`, `REFUND_OUTCOME_UNKNOWN`, `REFUND_NEEDS_MANUAL_HANDLING`.

## Refund waiting for manual handling (`AWAITING_CAPABILITY`)

This is expected today: no partner refund API is approved (OQ-12).

1. Refund in the partner's portal: full card amount, in the card currency, against the original
   charge.
2. Record it: `POST /v1/admin/refunds/:id/record-manual` with `providerReference` (the
   partner's refund ID) and a note. The payment becomes `REFUNDED` and the tourist is notified.
3. Never record a refund that has not actually been made.

## Refund failed (`FAILED`)

1. Read the partner's failure code in `GET /v1/admin/refunds`. Look up the payment for the
   original charge.
2. If the charge is too old or was disputed, coordinate with the partner. A chargeback may
   already have returned the money: check before refunding.
3. To try again, request a **new** refund with a new idempotency key. It needs a fresh
   maker-checker approval.

## Outcome unknown (`SUBMITTED` with `REFUND_OUTCOME_UNKNOWN`)

The request may have reached the partner. **Do not request another refund.**

1. Ask the partner for the status of request reference `<payment reference>-<RF reference>`.
2. If it succeeded, record it with `record-manual` once a manual path exists for `SUBMITTED`.
   Until then, ask engineering to update the adjustment through a reviewed, audited migration
   script.
3. If it was never received, engineering moves it back to `APPROVED` the same way. The job
   then sends it once.

> Gap: there is no admin endpoint yet to resolve a `SUBMITTED` refund by hand. It is listed in
> the production checklist.
