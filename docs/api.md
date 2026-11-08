# API

The machine-readable contract is **`api/docs/openapi.json`**. Regenerate it with
`npm run openapi:export`. Outside production, Swagger UI is served at `/docs` when
`ENABLE_API_DOCS=true`, and always in local and test. The example responses the app relies on
are in `contracts/fixtures/`, recorded by the e2e tests.

## Conventions

- **Base paths:**
  - `/v1`: the tourist app
  - `/v1/admin`: operations
  - `/v1/webhooks`: partners
  - `/health/*` and `/metrics`: the platform
- **Auth:** `Authorization: Bearer <access token>`. User and admin tokens are separate. A user
  token on an admin route returns `401`.
- **Request ID:** send a well-formed `X-Request-Id`, or one is generated. It is echoed back and
  is present in every error and log line, including the worker jobs it starts.
- **Device:** the app sends `X-Device-Id`, its install ID, used for device binding and risk.
- **Step-up:** sensitive calls need `X-Step-Up-Token`, obtained from `POST /v1/auth/step-up`. It
  is single-use, lasts 2 minutes, and is bound to its purpose:
  - `PAYMENT`
  - `CHANGE_PIN`
  - `DELETE_ACCOUNT`
  - `REGISTER_DEVICE_KEY`

  Card add and remove are protected by the partner's own verification (3-D Secure) and by the
  session; they do not need a step-up.
- **Idempotency:** `POST /v1/payments` requires `Idempotency-Key` (8–100 characters of
  `[A-Za-z0-9_-]`).
  - Same key and same body → the same payment (`200`). The first call returns `201`.
  - Same key with a different body → `409 IDEMPOTENCY_KEY_REUSED`.
  - Admin refund requests take `idempotencyKey` in the body.
- **Money:** integers in minor units with an explicit currency (`amountRwf`, `totalCardMinor` +
  `cardCurrency`). FX rates are decimal strings. Floats are never used for money.
- **Time:** ISO 8601 UTC. Receipts also carry a Kigali-formatted time.
- **Simulation:** every response derived from the mock provider carries `simulated: true`, and
  `/v1/app-config` reports `providerMode: SANDBOX`.
- **Pagination:** history uses `?limit=&cursor=` and returns `nextCursor`.

## Errors

Every error has the same envelope:

```json
{ "error": { "code": "PAYEE_NOT_FOUND", "message": "We couldn't find this MoMo account. Check the number with the seller.", "details": {}, "requestId": "…" } }
```

The app maps `code` to localised text and never shows `message` verbatim. Codes are stable:

| Status | Codes |
|---|---|
| 400 | VALIDATION_FAILED, IDEMPOTENCY_KEY_REQUIRED, OTP_INVALID, OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED, INVALID_PAYEE_IDENTIFIER |
| 401 | UNAUTHENTICATED, PIN_INVALID, STEP_UP_REQUIRED, SESSION_REVOKED, INVALID_CREDENTIALS, ADMIN_TOTP_REQUIRED, WEBHOOK_REJECTED |
| 403 | FORBIDDEN, ACCOUNT_BLOCKED, MAKER_CHECKER_VIOLATION |
| 404 | NOT_FOUND (also for another user's resources) |
| 409 | CONFLICT, IDEMPOTENCY_KEY_REUSED, PIN_NOT_SET, PROFILE_INCOMPLETE, CARD_LIMIT_REACHED, CARD_NOT_ACTIVE, CARD_SETUP_INCOMPLETE, QUOTE_EXPIRED, QUOTE_ALREADY_USED, PAYMENT_ALREADY_IN_PROGRESS, PAYMENT_PENDING_REVIEW, PAYMENT_STATE_CONFLICT, REFUND_NOT_ALLOWED |
| 422 | CARD_NOT_ELIGIBLE, CARD_SETUP_FAILED, NETWORK_NOT_SUPPORTED, PAYEE_NOT_FOUND, PAYEE_INACTIVE, PAYEE_BLOCKED, FEATURE_DISABLED, AMOUNT_OUT_OF_RANGE, LIMIT_EXCEEDED |
| 423 | PIN_LOCKED |
| 429 | RATE_LIMITED (`details.retryAfterSeconds`) |
| 500 | INTERNAL_ERROR (no internals leaked) |
| 503 | PAYMENTS_PAUSED, PROVIDER_UNAVAILABLE, CAPABILITY_NOT_CONFIGURED, CONFIGURATION_NOT_APPROVED |

## Tourist app endpoints

| Area | Endpoints |
|---|---|
| App | `GET /v1/app-config` (public: sandbox/live mode, features, OTP/PIN lengths, legal versions, banner) |
| Sign-in | `POST /v1/auth/otp`, `POST /v1/auth/verify`, `POST /v1/auth/refresh`, `POST /v1/auth/logout` |
| PIN & step-up | `POST /v1/me/pin`, `POST /v1/me/pin/change`, `POST /v1/auth/pin/verify`, `POST /v1/auth/step-up/challenge`, `POST /v1/auth/step-up`, `POST`/`DELETE /v1/me/device-key` |
| Profile | `GET`/`PATCH`/`DELETE /v1/me` |
| Cards | `POST /v1/cards/setup` (→ hosted page URL), `POST /v1/cards` (complete setup), `GET /v1/cards`, `PATCH /v1/cards/:id` (default), `DELETE /v1/cards/:id` |
| Payees | `POST /v1/payees/lookup`, `GET /v1/payees/recent` |
| Quotes | `POST /v1/quotes` |
| Payments | `POST /v1/payments`, `GET /v1/payments` (history, filters), `GET /v1/payments/:id` (status, `nextAction` for 3-D Secure, receipt) |
| Support | `POST /v1/tickets`, `POST /v1/payments/:id/tickets`, `GET /v1/tickets` |
| Notifications | `GET /v1/notifications`, `POST /v1/notifications/:id/read`, `POST /v1/push-tokens` |
| Analytics | `POST /v1/analytics/events` (allowlisted names and properties only) |
| Website (public) | `POST /v1/launch/waitlist` (201 new, 200 existing spot), `GET /v1/launch/waitlist/:referralCode`, `POST /v1/launch/waitlist/leave` (emailed token; deletes the entry), `POST /v1/launch/hustle-check`, `GET`/`POST /v1/launch/stories` (POST → 202, shown after review), `GET /v1/launch/stats` |

**Web clients.** `POST /v1/auth/verify` accepts `platform: "web"`. `POST /v1/cards/setup` and
`POST /v1/payments` accept `returnTo: "WEB"`: the hosted card page returns to
`{WEB_APP_BASE_URL}/app/cards/return?setupId=…` and 3-D Secure to
`{WEB_APP_BASE_URL}/app/payments/return?paymentId=…` instead of the app deep links.

## Admin endpoints

Every route checks a permission (`api/src/modules/admin/permissions.ts`).

| Area | Endpoints | Permission |
|---|---|---|
| Auth | `POST /v1/admin/auth/login` → `POST /v1/admin/auth/totp`, `refresh`, `logout`, `GET /v1/admin/me` | — |
| Admins | `GET`/`POST /v1/admin/admin-users`, `PATCH /v1/admin/admin-users/:id` | `admins:manage` |
| Payments | `GET /v1/admin/payments` (reference, provider ref, email, phone, MoMo, last 4, state, dates), `GET /v1/admin/payments/:id`, `GET /v1/admin/review-queue` | `payments:read` (masked without `personal-data:unmasked`) |
| Review actions | `POST /v1/admin/payments/:id/actions` `{action, reason}` | `payments:review` |
| Refunds | `POST /v1/admin/payments/:id/refunds` · `GET /v1/admin/refunds` · `POST /v1/admin/refunds/:id/approve` · `reject` · `record-manual` | `refunds:request` / `payments:read` / `refunds:approve` |
| Risk | `GET`/`POST`/`DELETE /v1/admin/blocks`, `GET /v1/admin/risk-flags`, `PATCH /v1/admin/risk-flags/:id` | `risk:read`, `blocks:manage` |
| Configuration | `GET /v1/admin/config/:key`, `POST /v1/admin/config/:key` (draft), `POST /v1/admin/config/:key/versions/:v/activate` | `config:read`, `config:manage` |
| Reconciliation | `GET`/`POST /v1/admin/reconciliation/runs`, `POST …/settlement-files`, `GET …/runs/:id/items`, `GET …/runs/:id/export.csv`, `PATCH …/items/:id` | `reconciliation:read` / `:manage` |
| Tickets | `GET /v1/admin/tickets`, `PATCH /v1/admin/tickets/:id` | `tickets:read`, `tickets:manage` |
| Audit | `GET /v1/admin/audit-logs` | `audit:read` |
| Launch | `GET /v1/admin/launch/waitlist`, `GET /v1/admin/launch/hustle-check`, `GET /v1/admin/launch/stories`, `PATCH /v1/admin/launch/stories/:id` (approve/reject, audited) | `launch:read`, `launch:moderate` |
| Metrics | `GET /v1/admin/metrics/summary` (completion rate, volume, median time to pay, p95 settlement, failure reasons) | `metrics:read` |

Configuration keys:

- `FEES`
- `LIMITS` (including the `paymentsPaused` kill switch)
- `FX_RATES`
- `CARD_RULES`
- `PAYEE_ROUTING`

## Partner and platform

- `POST /v1/webhooks/partner`: see `security.md` § Webhooks. Mock provider only; otherwise
  `503 CAPABILITY_NOT_CONFIGURED`.
- `GET /health/live`, `GET /health/ready`, `GET /metrics` (bearer `METRICS_TOKEN` in
  production).
- Development only:
  - `/dev/mock-provider/*`: mock hosted card and 3-D Secure pages
  - `GET /dev/inbox`: OTPs and emails when `EMAIL_TRANSPORT=dev-inbox`

  Neither exists in production.
