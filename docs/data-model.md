# Data model

PostgreSQL is the source of truth. The schema is created by explicit SQL migrations in
`api/src/database/migrations/` (0001–0004). TypeScript row types are in
`api/src/database/schema.ts`. `test/integration/schema-drift.spec.ts` fails if the two
disagree.

General rules:

- UUID primary keys.
- `timestamptz` everywhere.
- Money is `bigint` minor units plus `char(3)` currency.
- `updated_at` is maintained by a trigger.
- Enumerations are `CHECK` constraints.

## Identity (0002)

| Table | Purpose | Notable constraints |
|---|---|---|
| `users` | Tourist profile: name, residence country, date of birth, language, status (`PENDING_PROFILE`/`ACTIVE`/`BLOCKED`/`DELETED`), KYC fields, PIN hash and lockout counters | Unique email and unique phone where set (deletion clears them, so the address can be reused) |
| `user_identities` | Sign-in identities (email, phone; Apple/Google later) | Unique (provider, subject) |
| `consents` | Terms/Privacy acceptance with document version and time | Unique (user, document, version); kept after account deletion |
| `otp_challenges` | OTP as HMAC only, attempts, expiry, resend time | — |
| `sessions` | Refresh-token hash, previous hash (30 s grace), device/install ID, revocation reason | Refresh-token hash unique; rotation and reuse detection |
| `device_keys` | Public keys for biometric step-up (Ed25519 or ES256) | One active key per session |
| `step_up_challenges`, `step_up_grants` | Nonces to sign; single-use grants bound to purpose and session | `purpose` CHECK |
| `admin_users`, `admin_login_challenges`, `admin_sessions` | Admin accounts (Argon2id password, encrypted TOTP secret, last used TOTP step), login challenges, sessions | Roles CHECK |

## Payments (0003)

| Table | Purpose | Notable constraints |
|---|---|---|
| `blocklist_entries` | Blocked card fingerprints, payees, devices (users are blocked via `users.status`) | Active entry unique per (type, value) |
| `card_setup_sessions` | Hosted card-setup sessions and their partner IDs | Expiry |
| `cards` | Partner token (**encrypted**, AES-256-GCM with key ID), brand, last 4, expiry, issuing country, funding, fingerprint, default flag | At most one active default per user; one active card per (user, fingerprint); **no PAN/CVV columns** |
| `payees` | MTN MoMo account (E.164 or merchant code), registered name from the partner, last verified time | Unique (network, type, identifier) |
| `user_payees` | Recent payees per user | — |
| `quotes` | Amount RWF, fee, FX rate (scaled 1e8), card currency, card total, config versions used, expiry | Single use |
| `payments` | Public reference `XD-XXXXXX`, state, user, card, payee, quote, amounts, idempotency key + request hash, note (scrubbed), review reason, provider IDs, a timestamp per state, device hash | Unique `(user_id, idempotency_key)`; reference format CHECK |
| `payment_events` | Every transition and notable event: from/to, source (`APP`/`PROVIDER`/`OPS`/`WORKER`/`SYSTEM`), actor, reason | **Append-only** (trigger refuses UPDATE/DELETE) |
| `provider_operations` | One row per provider call: type (`AUTHORISATION`/`PAYOUT`/`CAPTURE`/`VOID`/`REFUND`), our `request_ref`, partner ref, status, raw status, redacted response, check count | `request_ref` unique; **one payout per payment**; one authorisation; one live capture/void/refund |
| `payment_adjustments` | `VOID`, `REFUND`, `PAYOUT_REVERSAL` records with status, amount, requester/approver, partner ref | Approver ≠ requester (CHECK); one live refund per payment; idempotency key unique |
| `inbound_provider_events` | Verified partner callbacks | Unique (provider, external event ID) |
| `risk_flags` | Rule hits with severity, action (`FLAG`/`HOLD`/`BLOCK`), evidence, review status | — |

## Operations (0001, 0004)

| Table | Purpose | Notable constraints |
|---|---|---|
| `audit_logs` | Who, what, when, before/after (redacted), request ID | **Append-only**: row and TRUNCATE triggers |
| `outbox_events` | Durable jobs: type, payload, status, attempts, lease, next run time, dedupe key | Dedupe key unique among live jobs |
| `configuration_versions` | Versioned `FEES`/`LIMITS`/`FX_RATES`/`CARD_RULES`/`PAYEE_ROUTING` with draft/active status, approval reference, author | One active version per key |
| `notifications` | In-app inbox rows and the delivery log for push/SMS/email | Dedupe key unique (no duplicate notifications); SMS/email text never stored |
| `push_tokens` | Encrypted device push tokens | Revoked on logout and account deletion |
| `tickets` | Support tickets (`TK-XXXXXX`) with category, message (scrubbed), payment state snapshot | Message ≤ 1000 characters |
| `reconciliation_runs`, `reconciliation_items` | Runs per business date and source; one item per difference with resolution | Resolution needs resolver + note |
| `analytics_events` | Allowlisted events, no personal data | — |

## Personal data inventory

| Data | Where | Protection |
|---|---|---|
| Name, date of birth, country | `users` | Masked for viewers and in logs; anonymised on deletion |
| Email, phone | `users`, `user_identities`, `otp_challenges` (destination) | Same |
| Seller MoMo number and registered name | `payees` | Masked for viewers; first name only in tourist-facing copy |
| Card token | `cards.token_encrypted` | Field encryption; never returned by the API |
| Push tokens, TOTP secrets | `push_tokens`, `admin_users` | Field encryption |
| IP / device | `sessions` (install ID), `payments.device_id_hash` | Hashed where used for risk |

Retention periods are pending legal input (OQ-26). Until then, payment, consent and audit records
are kept after account deletion and linked only to the anonymised user ID.
