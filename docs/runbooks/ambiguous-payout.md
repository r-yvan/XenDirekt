# Ambiguous payout, review queue, reversal, failed void

**Signals:** `PENDING_REVIEW`, `REVIEW_UNRESOLVED_24H`, `PAYOUT_REVERSED`, `VOID_FAILED`
alerts; items in `GET /v1/admin/review-queue`.

**The one rule:** a payout whose outcome is unknown is **never** sent again. The database also
refuses a second payout for a payment.

## 1. Look at the payment

`GET /v1/admin/payments/:id` shows:

- `reviewReason`
- the timeline (`payment_events`)
- every provider operation, with its request reference, provider reference, status, raw
  provider status and check count

| reviewReason | Meaning | Usually |
|---|---|---|
| `NO_FINAL_STATE_2MIN` / `PAYOUT_OUTCOME_UNKNOWN` | Payout sent, no final answer | Resolves by itself when the partner answers; reconciled every 30 s → 15 min for 24 h |
| `AUTH_OUTCOME_UNKNOWN` | Card authorisation outcome unknown | Status polling; partner check if it persists |
| `CAPTURE_OUTCOME_UNKNOWN` | Capture sent, no answer | See [capture-failure](capture-failure.md) |
| `VOID_FAILED` | The hold could not be released | The tourist's hold will expire at the issuer (typically 7–30 days); ask the partner to release it |
| `RISK_HOLD` | Held by a risk rule before payout | See [suspected-fraud](suspected-fraud.md) |
| `PAYOUT_REVERSED_AFTER_SUCCESS` | Money came back from the seller's wallet | Below |

## 2. If the 24-hour automatic reconciliation did not resolve it

1. Ask the partner for the payout's status by **our** reference (the operation's
   `requestRef`, sent as their `customerRef`). Ask for written confirmation.
2. Record the answer with an action. Always include the partner's reference in `reason`.
   - Partner confirms the seller **was** paid → `CONFIRM_PAYOUT_SUCCEEDED`. The card is then
     captured.
   - Partner confirms the payout **failed** or was never created → `CONFIRM_PAYOUT_FAILED`.
     The hold is released, and the tourist gets "You have not been charged".
   - Partner cannot say → leave it in review, escalate with the partner, and tell the tourist
     we are checking (the app already says "You will not be charged twice").

## 3. Payout reversed after success

`PAYOUT_REVERSAL` adjustment, `PAYOUT_REVERSED` alert. The seller received the money and then
lost it, usually because of a wrong or blocked account.

1. Contact the seller (phone from the payment detail, `personal-data:unmasked` role).
2. Decide with the PM: either the tourist gets a refund ([refund-failure](refund-failure.md),
   normal refund flow), or the seller is paid again **outside** the automated flow, with
   finance approval. There is no button for the second option, on purpose.
3. Resolve the matching reconciliation item with a note.
