# Deployment

Nothing has been deployed. This repository targets no specific cloud: the hosting region is
undecided under Law n° 058/2021 (OQ-05). This document describes what any target needs.

## Runtime topology

| Component | How | Notes |
|---|---|---|
| API | `node dist/main.js` (Docker image from `api/Dockerfile`) | Stateless. Two or more instances behind a TLS load balancer. Liveness `GET /health/live`, readiness `GET /health/ready` (checks the database). |
| Worker | Same image, `node dist/worker.js`, `WORKER_MODE=separate` | One or more instances. Outbox claiming and advisory locks make several workers safe. |
| Migrations | Same image, `node dist/database/cli/migrate.js latest` | Run as a release job **before** the new API/worker version starts. Migrations are forward-only SQL, so a rollback means a new migration. |
| PostgreSQL | Managed PostgreSQL 16+ (CI uses 17, development 18) | `DATABASE_SSL=require`. Point-in-time recovery on. Database in the approved region. |
| Redis | Managed Redis 7 | Rate-limit counters only. Can be flushed without losing money state. |
| Secrets | The platform's secret manager | Injected as environment variables. Never baked into images. |
| Mobile | Store builds of `android-ios` | Built with `--dart-define=API_BASE_URL=https://… --dart-define=APP_ENV=production --dart-define=CERT_PINS_PEM=…` |

`docker compose --profile app up` runs the same topology locally: PostgreSQL on port 55432,
Redis, Mailpit, migrate, api and worker.

## Environment variables

The full list, with descriptions, is in `api/.env.example`. The schema is
`api/src/config/env.schema.ts`, and the API refuses to start on any invalid value.

**Production startup guards.** The API and worker refuse to start in production unless all of
these hold:

- `PAYMENT_PROVIDER` is not `mock`;
- `PROVIDER_CAPABILITY_APPROVALS` lists evidence for every critical capability, plus
  `STATUS_WEBHOOKS` or `STATUS_POLLING_ACCEPTED`;
- `REDIS_URL` and `METRICS_TOKEN` are set;
- `DATABASE_SSL=require`;
- `PUBLIC_BASE_URL` is https;
- `ENABLE_API_DOCS=false`;
- there are no placeholders, reused secrets, or dev transports (`dev-inbox`,
  `dev-email-bridge`, inline worker).

**With today's adapters these guards make a production start impossible.** That is
intentional: real money must not move until the partner capabilities exist (see
`provider-capability-matrix.md`).

| Group | Variables |
|---|---|
| Runtime | `APP_ENV`, `PORT`, `PUBLIC_BASE_URL`, `LOG_LEVEL`, `TRUST_PROXY`, `CORS_ALLOWED_ORIGINS`, `ENABLE_API_DOCS`, `WORKER_MODE` |
| Data | `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_SSL`, `REDIS_URL` |
| Secrets | `JWT_ACCESS_SECRET`, `JWT_ADMIN_SECRET`, `OTP_HMAC_SECRET`, `PIN_PEPPER`, `FIELD_ENCRYPTION_KEY`, `FIELD_ENCRYPTION_KEY_ID` |
| Token lifetimes | `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `ADMIN_ACCESS_TOKEN_TTL_SECONDS`, `ADMIN_REFRESH_TOKEN_TTL_HOURS` |
| Provider | `PAYMENT_PROVIDER`, `PROVIDER_CAPABILITY_APPROVALS`, `XENTRIPAY_BASE_URL`, `XENTRIPAY_API_KEY`, `XENTRIPAY_CONNECT_TIMEOUT_MS`, `XENTRIPAY_RESPONSE_TIMEOUT_MS`, `MOCK_PROVIDER_LATENCY_MS`, `MOCK_WEBHOOK_SECRET` |
| Notifications | `EMAIL_TRANSPORT`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `SMS_TRANSPORT`, `PUSH_TRANSPORT` |
| Operations | `METRICS_TOKEN` |
| Features | `FEATURE_MERCHANT_CODES`, `FEATURE_FEDERATED_SIGN_IN`, `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS` |
| Legal | `TERMS_VERSION`, `PRIVACY_VERSION`, `TERMS_URL`, `PRIVACY_URL` |

## First-time setup of an environment

1. Create the database and user, then run migrations.
2. Create the first admin:

   ```bash
   node dist/modules/admin/cli/create-admin.js \
     --email ops@… --name "…" --role ADMIN
   ```

   It prints a one-time password and a TOTP provisioning URI once; enrol them immediately.
3. Configure fees, limits, FX, card rules and payee routing through
   `POST /v1/admin/config/:key` and activate them with an `approvalReference`. Unapproved
   money configuration is refused in production (`CONFIGURATION_NOT_APPROVED`). The built-in
   placeholders are for development only.
4. Point the metrics scraper at `/metrics` with the bearer token, and set up the rules in
   `api/docs/alerts.md`.

## Backups and restore (NFR-AVL-02)

The target is daily full backups plus continuous WAL (point-in-time recovery), kept for 30 days,
encrypted, in the same legal region.

**Restore drill.** Run it before launch, then quarterly:

1. Restore the latest backup to a new instance.
2. Run `node dist/database/cli/migrate.js latest`. It must report nothing to apply.
3. Start an API against it with `WORKER_MODE=disabled`, then check:
   - `GET /health/ready`;
   - that a known payment's timeline and audit entries are complete.
4. Record the time to restore (RTO) and the data-loss window (RPO).

> Not done yet: no environment exists. This is a launch blocker.

## Releases

- CI (`.github/workflows/ci.yml`) runs:
  - API: format, lint, typecheck, unit, contract, integration and e2e tests against
    PostgreSQL 17, then the build;
  - Flutter: format, analyze, tests;
  - gitleaks;
  - npm audit for high and critical issues in production dependencies.
- Deploy order: migrations → worker → API. Every migration so far is additive. Keep it that way
  (expand, then contract) so the old and new versions can run side by side.
- Mobile releases go through store review. The server must keep accepting the previous app
  version's requests (`/v1` is stable; breaking changes need `/v2`).
