# Reconciliation mismatch

**Signals:**

- `RECONCILIATION_MISMATCH` or `RECONCILIATION_FAILED`.
- `xd_reconciliation_unresolved_items > 0` for 24 h.
- No completed run for yesterday by 06:00 Kigali time.

Reconciliation never changes payments. Each difference is an item to explain.

## Run failed or missing

1. `GET /v1/admin/reconciliation/runs`: read the `error`.
2. If the partner was unavailable, re-run after it recovers:
   `POST /v1/admin/reconciliation/runs {businessDate}`. Runs are repeatable, and each one is a
   new snapshot.

## Working the items

`GET /v1/admin/reconciliation/runs/:id/items?unresolved=true`

| matchState | Likely cause | Action |
|---|---|---|
| `STATUS_MISMATCH` | We still think `PENDING`/`UNKNOWN`, the partner says final (or the reverse) | Usually a payment in review. Follow [ambiguous-payout](ambiguous-payout.md). Resolve the item once the payment is consistent. |
| `MISSING_AT_PROVIDER` | We recorded an operation the partner does not know | If the request certainly never arrived, the payment should already be failed or voided. If not, escalate. Never re-send. |
| `MISSING_INTERNAL` | The partner has a transaction we did not create | **Treat as suspicious.** It could be a wrong date, another merchant account, or misuse of credentials. Escalate to the partner and security. |
| `AMOUNT_MISMATCH` / `CURRENCY_MISMATCH` | Fees deducted differently than assumed (OQ-16), or an error | Compare with the quote. Finance decides. Note the explanation. |
| `REVERSAL` | Payout reversed after success | [ambiguous-payout](ambiguous-payout.md) §3 |

Resolve each one with `PATCH /v1/admin/reconciliation/items/:id`
`{status: RESOLVED | NOT_APPLICABLE, note}`. The note is the audit evidence: include partner
references.

Export for finance: `GET /v1/admin/reconciliation/runs/:id/export.csv`.
