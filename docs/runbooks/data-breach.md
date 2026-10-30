# Suspected data breach

Applies to any suspected exposure of personal data (names, emails, phone numbers, dates of
birth), credentials or secrets (API keys, JWT secrets, encryption key, pepper), or admin
account compromise.

Card numbers are not stored by XenDirekt. If one is found anywhere, that itself is an incident.

## First hour

1. **Contain without destroying evidence.**
   - Revoke compromised admin accounts: `PATCH /v1/admin/admin-users/:id` (status `DISABLED`).
   - Block affected users: `POST /v1/admin/blocks` (`USER`). This ends their sessions.
   - Rotate leaked secrets in the secret manager and redeploy (next section).
2. Snapshot the logs and the `audit_logs` table for the period (`GET /v1/admin/audit-logs?from=&to=`).
   `audit_logs` is append-only.
3. Open an incident record: who, what, when, and which data categories.

## Secret rotation effects

| Secret | Effect of rotating |
|---|---|
| `JWT_ACCESS_SECRET` / `JWT_ADMIN_SECRET` | Every access token is invalid at once. Users refresh (refresh tokens are opaque and unaffected); admins sign in again. |
| Refresh tokens (database) | `UPDATE sessions SET revoked_at = now()` through a reviewed script signs everyone out. |
| `OTP_HMAC_SECRET` | Pending OTP codes stop working. Users request a new one. |
| `PIN_PEPPER` | **Every PIN stops verifying.** Users must reset their PIN. Rotate only if the pepper **and** the database leaked together. |
| `FIELD_ENCRYPTION_KEY` | Add a new key ID and re-encrypt the card tokens (not automated yet). Ask the partner to rotate card tokens if the key and the database leaked together. |
| `XENTRIPAY_API_KEY` | Rotate in the partner portal. Payouts stop until it is updated. |
| `METRICS_TOKEN`, `MOCK_WEBHOOK_SECRET` | No user impact. |

## Within 72 hours

- Law n° 058/2021 requires notifying the supervisory authority (NCSA) and, where there is high
  risk, the affected people. Legal decides; engineering supplies the facts. (OQ-05 and OQ-26
  cover hosting and retention; get the legal contact confirmed **before** launch.)
- Tell the payment partner if card tokens, payout credentials or the API key may be affected.

## Afterwards

Write a post-incident review. Add a test or guard that would have caught the issue (as
`pan-leak.e2e` does for card numbers).
