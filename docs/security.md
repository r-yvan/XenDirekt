# Security and privacy

This document says what the code does today. It is **not** a compliance claim: no PCI DSS
assessment, penetration test or legal review has been done. "SAQ-A" is a design target that a
partner's hosted fields would make possible. It is not something this repository can claim.

## Card data (NFR-SEC-01)

- Card numbers and CVVs are typed only into the **partner's hosted page**, opened in a WebView
  (`core/web/hosted_page_launcher.dart`). The app has no card-number field.
- The API stores the partner's card token **encrypted** (AES-256-GCM, `shared/crypto/field-encryption.ts`,
  key ID kept with the ciphertext so keys can rotate), plus brand, last 4, expiry, issuing
  country, funding type and a fingerprint.
- Free text that a tourist might paste a card number into has 13–19 digit Luhn-valid runs
  replaced by `[REDACTED_PAN]` before storage:
  - the payment note, which is also sent to the seller by SMS
  - the support-ticket message

  Analytics events with such values are rejected outright.
- Logs pass through `common/logging/redaction.ts`. It removes secret keys (PIN, OTP, password,
  tokens), masks personal keys (email, phone, names) and scrubs card numbers inside any string.
- **Test:** `api/test/e2e/pan-leak.e2e.spec.ts` runs the main flows and pastes a card number into
  every free-text field. It then scans **every table** and every recorded contract fixture for
  Luhn-valid 13–19 digit sequences. Disabling the scrub makes the test fail (checked).

## Authentication (ADR 0005)

| Control | Implementation |
|---|---|
| OTP | 6 digits, stored only as an HMAC-SHA256 with a server secret. Expires after 5 min, max 5 attempts, 30 s resend cooldown. Rate-limited per destination, IP and device. |
| Access token | HS256 JWT, 15 min, audience `xendirekt-app`. Admin tokens use a different secret and audience. |
| Refresh token | Opaque, hashed at rest, rotated on every use, bound to the session and install ID. A 30 s grace window covers a lost response. Reuse after that window revokes the whole session (theft detection). |
| PIN | Exactly 6 digits. Trivial PINs are refused. Argon2id (node:crypto) with the pepper passed as Argon2's secret parameter. Locked for 15 min after 5 failures. |
| Step-up | Every payment and sensitive change needs a step-up grant. A grant is single-use, lasts 2 min, is bound to its purpose and session, and is obtained with the PIN or a device-key signature (Ed25519 key kept in the device keystore and unlocked by biometrics). The server also verifies ES256. |
| App lock | The app locks after 5 min in the background. Unlocking needs biometrics or the PIN. |
| Admin | Email + password (Argon2id) + TOTP (RFC 6238, replay-protected). Role permissions are checked on the server for every route (`admin/permissions.ts`). |

## Authorisation

- Tourist resources are always queried with `user_id = <token subject>`. Another user's
  payment returns 404, not 403 (e2e scenario 14).
- Admin roles are `VIEWER`, `SUPPORT_AGENT`, `RISK_ANALYST` and `ADMIN`.
  - Viewers get masked personal data.
  - Refunds need a **different** Admin to approve, enforced in the service and by a database CHECK.
  - Every admin mutation is written to the append-only `audit_logs` table. A trigger refuses
    UPDATE, DELETE and TRUNCATE on it.
- Prohibited actions are tested (e2e scenario 15).

## Transport and HTTP hardening

- TLS terminates at the platform load balancer: TLS 1.2+, HSTS. Production refuses a non-https
  `PUBLIC_BASE_URL` and requires `DATABASE_SSL=require`.
- `helmet` sets security headers and a strict CSP for the dev hosted pages. JSON bodies are
  limited to 64 KB. The one exception is the settlement-file upload, limited to 6 MB.
- CORS is off unless `CORS_ALLOWED_ORIGINS` is set. The mobile app needs none.
- **Certificate pinning (NFR-SEC-02):** pass PEM certificates at build time with
  `--dart-define=CERT_PINS_PEM=…`. The Dio client then trusts **only** those certificates
  (`core/network/pinned_adapter_io.dart`). Which certificates to pin, and the rotation plan, are
  open (OQ-35). Without the define, pinning is **off** and the platform trust store is used.
- Android:
  - `FLAG_SECURE` on the payment progress, PIN setup, PIN prompt and lock screens. It is
    reference-counted, so a PIN sheet closing over a payment screen keeps it on.
    Local design-review builds can switch it off with
    `--dart-define=XD_ALLOW_SCREENSHOTS=true`; it is on unless that flag is passed, and
    release builds must never pass it.
  - `allowBackup=false`.
  - Cleartext traffic denied in release builds.
- iOS has no screenshot-blocking API. The app-switcher cover hides content instead.

## Rate limits

Counters live in Redis in production. Local runs use an in-memory fallback.

| Endpoint | Limits |
|---|---|
| `POST /v1/auth/otp` | 5 per destination per hour · 20 per IP per hour · 10 per device per hour |
| `POST /v1/auth/verify` | 30 per IP per 10 min (plus 5 attempts per challenge) |
| `POST /v1/auth/refresh` | 60 per IP per 10 min |
| PIN verify / step-up | 20 per user per 10 min |
| `POST /v1/payees/lookup` | 60 per user per 10 min, 300 per day (limits name enumeration) |
| `POST /v1/quotes` | 120 per user per 10 min |
| `POST /v1/payments` | 20 per user per 10 min |
| Card setup / complete | 10 / 20 per user per hour |
| Tickets | 10 per user per hour |
| Admin TOTP | 20 per IP per 15 min |
| Webhooks | 600 per IP per minute |

## Webhooks (NFR-SEC-06)

- A callback is a **hint**, never a source of truth. A valid callback records the event once
  per `(provider, event id)` and triggers a status poll. Only the poll's result changes state.
- Only the **mock** provider has a signature scheme, and it is ours:
  `X-Mock-Signature: t=…,v1=HMAC-SHA256(secret, "t.body")`, with a 5-minute tolerance and a
  constant-time comparison.
- Invalid events are **not stored**, so a forged event ID cannot pre-empt a genuine one.
- XentriPay has published no signature contract, so its callbacks are refused with
  `CAPABILITY_NOT_CONFIGURED` (OQ-11). Source-IP allowlisting is a platform (ingress) control
  and is not configured here.

## Secrets

- Every secret comes from the environment, injected by a secret manager in deployed
  environments. `.env` files are git-ignored.
- At startup, `startup-guards.ts` refuses:
  - placeholder values copied from `.env.example`
  - an all-zero encryption key
  - secrets reused across purposes
  - in production: the mock provider, missing capability approvals, a missing Redis or
    metrics token, Swagger enabled, and dev conveniences (inline worker, dev inbox, SMS bridge)
- CI runs gitleaks over the full history and `npm audit --omit=dev --audit-level=high`.

## Privacy (Law n° 058/2021, NFR-SEC-08)

- Consent records keep the document version and a timestamp.
- Analytics accepts only allowlisted event names and properties, with no personal data.
- Account deletion (step-up required) does the following:
  - revokes sessions, device keys and push tokens
  - removes sign-in identities
  - anonymises the profile (name, email, phone, date of birth, PIN hash)
  Payment and audit records are kept, because the retention period is undecided (OQ-26).
- The merchant SMS contains the tourist's first name only (OQ-32).
- Hosting region and data-processing agreements: OQ-05. **Legal review is required before
  launch.**
- `reference-docs/refunds-v2.pdf` contains a real person's personal data. It is git-ignored and
  was never copied into code, fixtures or docs (OQ-34).

## Known gaps

- No root/jailbreak detection: the vendor choice is open (OQ-30).
- Certificate pinning is not enabled (OQ-35).
- No sanctions/PEP screening: it depends on the partner (NFR-RSK-06).
- No penetration test, threat-model review or PCI assessment has been done.
- Admin SSO is not implemented (OQ-36).
