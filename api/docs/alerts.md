# Alerts

The API and worker emit two kinds of signal:

- **Structured logs** with an `alert` field: pino JSON, already redacted.
- **Prometheus metrics** at `GET /metrics`. In production this needs
  `Authorization: Bearer $METRICS_TOKEN`.

No alerting backend is configured in this repository. The rules below are what the platform's
log and metrics pipeline should implement. Thresholds are starting points for the pilot.

## Paging (respond within 15 minutes, 24/7 during the pilot)

| Alert | Source | Condition | Runbook |
|---|---|---|---|
| `CAPTURE_FAILED` | log | any | [capture-failure](../../docs/runbooks/capture-failure.md): the seller was paid but the card is not captured |
| `PAYOUT_REVERSED` | log | any | [ambiguous-payout](../../docs/runbooks/ambiguous-payout.md) |
| `REVIEW_UNRESOLVED_24H` | log | any | [ambiguous-payout](../../docs/runbooks/ambiguous-payout.md) |
| `REFUND_OUTCOME_UNKNOWN` | log | any | [refund-failure](../../docs/runbooks/refund-failure.md) |
| Provider outage | metric | `rate(xd_provider_errors_total{kind=~"unreachable\|unknown_outcome"}[5m]) > 0.2` for 5 min | [provider-outage](../../docs/runbooks/provider-outage.md) |
| Stuck payments | metric | `xd_payment_oldest_state_age_seconds{state=~"AUTHORISED\|PAYOUT_PENDING\|CAPTURE_PENDING\|VOID_PENDING"} > 600` | [provider-outage](../../docs/runbooks/provider-outage.md) |
| Dead jobs | metric | `increase(xd_outbox_jobs_total{outcome="dead"}[15m]) > 0` | [provider-outage](../../docs/runbooks/provider-outage.md) |
| API down | probe | `GET /health/ready` failing for 2 min | [provider-outage](../../docs/runbooks/provider-outage.md) (platform section) |

## Working hours (respond the same business day)

| Alert | Source | Condition | Runbook |
|---|---|---|---|
| `PENDING_REVIEW` | log | any, and queue size `xd_payments_non_final{state="PENDING_REVIEW"} > 0` for 30 min | [ambiguous-payout](../../docs/runbooks/ambiguous-payout.md) |
| `RISK_HOLD` | log | any | [suspected-fraud](../../docs/runbooks/suspected-fraud.md) |
| `VOID_FAILED` | log | any | [ambiguous-payout](../../docs/runbooks/ambiguous-payout.md): hold release |
| `REFUND_FAILED`, `REFUND_NEEDS_MANUAL_HANDLING` | log | any | [refund-failure](../../docs/runbooks/refund-failure.md) |
| `RECONCILIATION_MISMATCH` | log | any; or `xd_reconciliation_unresolved_items > 0` for 24 h | [reconciliation-mismatch](../../docs/runbooks/reconciliation-mismatch.md) |
| `RECONCILIATION_FAILED` | log | any, or no completed run for yesterday by 06:00 Kigali | [reconciliation-mismatch](../../docs/runbooks/reconciliation-mismatch.md) |
| `NOTIFICATION_FAILED` | log / metric | `increase(xd_notifications_failed_total[1h]) > 10` | check the email/SMS provider. Payments are unaffected. |
| `WEBHOOK_SIGNATURE_INVALID` | log | more than 20 in 10 min | [suspected-fraud](../../docs/runbooks/suspected-fraud.md) (probing) |
| Latency SLO | metric | p95 `xd_payee_lookup_duration_seconds` > 3 s, or quote route p95 > 1 s, over 30 min | NFR-PER-01. Compare with provider latency. |

## Security signals (route to the security owner)

- A spike in `401` responses on `/v1/auth/verify` or `/v1/admin/auth/totp` (credential stuffing).
- Refresh-token reuse detected (log message `Refresh token reuse detected; session revoked`, session `revoked_reason = REFRESH_REUSE`). The session is revoked
  automatically; review it for account takeover.
- Any of the above in combination with admin activity: [data-breach](../../docs/runbooks/data-breach.md).
