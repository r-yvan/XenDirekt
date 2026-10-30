# Runbooks

| Runbook | Use when |
|---|---|
| [provider-outage](provider-outage.md) | Partner unreachable or slow; payments stuck in flight; dead jobs |
| [ambiguous-payout](ambiguous-payout.md) | Payment in `PENDING_REVIEW`, payout outcome unknown, payout reversed, void failed |
| [capture-failure](capture-failure.md) | `CAPTURE_FAILED`: seller paid, card not captured |
| [refund-failure](refund-failure.md) | Refund failed, outcome unknown, or waiting for manual handling |
| [suspected-fraud](suspected-fraud.md) | Risk holds, fraud reports, webhook probing |
| [reconciliation-mismatch](reconciliation-mismatch.md) | Reconciliation items unresolved or a run failed |
| [data-breach](data-breach.md) | Suspected exposure of personal data or credentials |

General rules for every runbook:

1. **Never send a second payout.** Nothing in the admin API can do so. Do not ask the partner to
   "retry" a payout whose outcome is unknown. Ask for its **status** by our reference.
2. **Evidence before action.** Every admin action needs a reason, which is written to the audit
   log. Record the partner's reference or ticket number in it.
3. **Tourists first.** If a tourist may have been charged without the seller being paid, they
   hear from us the same day.
4. Use the admin API (`/v1/admin/...`, see `docs/api.md`). Do not edit the database by hand.
   `payment_events` and `audit_logs` are append-only, and manual edits break reconciliation.
