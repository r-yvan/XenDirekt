# Capture failure (seller paid, card not captured)

**Signal:** `CAPTURE_FAILED` alert; the payment is in `CAPTURE_FAILED` or in `PENDING_REVIEW`
with `CAPTURE_OUTCOME_UNKNOWN`.

**Impact:** XenDirekt (through the partner wallet) has paid the seller, but the tourist's card
still only has a hold. If the hold expires, the money is lost. **Never** pay out again: the
seller already has the funds.

## Steps

1. Open `GET /v1/admin/payments/:id`. Confirm the PAYOUT operation is `SUCCEEDED`, and check the
   CAPTURE operation's status and `failureCode`.
2. Ask the partner, giving the capture `requestRef`:
   - **Did the capture actually succeed?** Then wait: the next status poll completes the
     payment. If it doesn't, use `CONFIRM_PAYOUT_SUCCEEDED` from review, which re-runs the
     capture, and that is idempotent at the partner by request reference.
   - **Is the authorisation still valid?** Then `RETRY_CAPTURE` with a reason. A new capture
     request is made **only** when the previous one is definitively `FAILED`. The database
     allows only one live capture.
3. If the hold has expired or the issuer refuses:
   - record the loss with finance (amount: `totalCardMinor` in `cardCurrency`);
   - the payment stays `CAPTURE_FAILED`, the honest state; do not mark it completed;
   - do not contact the tourist to ask for money without a PM and legal decision.
4. Add the outcome to the reconciliation item for that date.

**Prevention:** `CAPTURE_FAILED` rates come from `xd_payment_transitions_total{to="CAPTURE_FAILED"}`.
More than one a week warrants a call with the partner about authorisation windows.
