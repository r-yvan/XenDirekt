# Suspected fraud

**Signals:**

- `RISK_HOLD` alerts.
- Open risk flags (`GET /v1/admin/risk-flags`).
- Partner or issuer fraud notices.
- Many `WEBHOOK_SIGNATURE_INVALID`.
- Tourists reporting payments they did not make.

## Risk-held payment (before payout: no money has left)

1. `GET /v1/admin/payments/:id`: look at the risk flags, the card (issuing country, funding),
   the payee and the user's history.
   - **Rules:** `CARD_ON_MULTIPLE_ACCOUNTS`, `CARDS_PER_DEVICE`, `NEW_PAYEE_MANY_PAYERS`,
     plus the limits.
2. Decide within the business day. The hold on the tourist's card is real.
   - Legitimate → `APPROVE_RISK_HOLD` with what you verified. The payout runs.
   - Fraudulent or unverifiable → `REJECT_AND_RELEASE`. The hold is released and nothing is
     paid out.
3. Close the flag: `PATCH /v1/admin/risk-flags/:id` with `CONFIRMED_FRAUD` or `DISMISSED` and a
   note.

## Confirmed fraud

1. Block what is involved (`POST /v1/admin/blocks`):
   - `USER`: ends all their sessions at once;
   - `CARD_FINGERPRINT`: the card cannot be added to any account;
   - `PAYEE`: no one can pay that MoMo account;
   - `DEVICE`.
2. Find related payments: search by card last 4, payee number and email
   (`GET /v1/admin/payments?...`).
3. For completed payments to a fraudulent payee, tell the partner. Recovery from a MoMo wallet
   is the partner's and operator's process.
4. If a tourist reports an unauthorised payment, assume their account is compromised: block the
   user, then contact them through the verified email.

## Webhook probing

Invalid signatures are never stored, and no state changes from callbacks. If the volume is
high, block the source at the ingress and tell the platform owner.
