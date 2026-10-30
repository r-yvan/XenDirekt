# XenDirekt

International tourists pay Rwandan **MTN MoMo** accounts with a foreign Visa or Mastercard.
The card is authorised first, the seller is paid through a licensed partner's payout API, and
the card is captured only after the payout is confirmed. A failed payout releases the hold.

> **Not production-ready. No real money can move.** Everything runs end to end against a
> deterministic **mock provider**. The only real adapter, XentriPay, covers MoMo payouts and
> payout status. The card capabilities (tokenisation, 3-D Secure, authorise, capture, void,
> refund) and the payee name lookup have no confirmed partner API. The production startup
> guards refuse to run until each one is approved with evidence. See
> [docs/provider-capability-matrix.md](docs/provider-capability-matrix.md) and
> [docs/open-questions.md](docs/open-questions.md).

| Directory | Contents |
|---|---|
| `api/` | NestJS 12 API and worker (TypeScript, PostgreSQL, Redis) |
| `android-ios/` | Flutter app for Android 9+ and iOS 15+ |
| `contracts/fixtures/` | API responses recorded by the e2e tests and decoded by the app's tests |
| `docs/` | Architecture, state machine, API, data model, security, operations, ADRs, runbooks |
| `web/` | Intentionally empty: the admin web UI is a later phase (the admin **API** exists) |
| `reference-docs/` | Source documents (read-only; contains personal data, do not copy) |

## Run it locally

Prerequisites:

- Node ≥ 24.7
- PostgreSQL 16+ (or Docker)
- Flutter 3.47+

```bash
# 1. Infrastructure (or use your own PostgreSQL and set DATABASE_URL)
docker compose up -d postgres redis mailpit

# 2. API
cd api
cp .env.example .env          # then replace every "replace-with" secret (commands are in the file)
npm ci
npm run db:migrate
npm run start:dev             # http://localhost:3000, Swagger at /docs, mock provider, inline worker
npm run admin:create -- --email ops@example.com --name "Ops Lead" --role ADMIN   # optional

# 3. App (another terminal). The Android emulator reaches the host at 10.0.2.2.
cd android-ios
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

**Sign-in codes.** With `EMAIL_TRANSPORT=smtp`, OTP emails appear in Mailpit at
http://localhost:8025. With `EMAIL_TRANSPORT=dev-inbox`, they are listed at `GET /dev/inbox`.

**Sandbox behaviour.** Pick sandbox cards on the mock card page. Choose payee outcomes by the
last four digits of the MTN number, for example `…1111` for a payout that fails. The full list
is in [docs/testing.md](docs/testing.md#mock-provider-development-and-tests-only).

To run the whole stack in containers: `docker compose --profile app up --build`.

## Tests

```bash
cd api
npm run lint && npm run typecheck && npm run format:check
npm test && npm run test:contract && npm run test:integration && npm run test:e2e
# integration and e2e use a database named *_test (TEST_DATABASE_URL)

cd ../android-ios
flutter analyze && flutter test

cd .. && scripts/live-integration.sh   # the app's real clients against a running API
```

## Documentation

| Document | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System context, modules, processing model |
| [docs/payment-state-machine.md](docs/payment-state-machine.md) | States, transitions, money-safety rules, review actions |
| [docs/api.md](docs/api.md) + `api/docs/openapi.json` | Conventions, errors, endpoints |
| [docs/data-model.md](docs/data-model.md) | Tables, constraints, personal-data inventory |
| [docs/security.md](docs/security.md) | Card data, auth, rate limits, webhooks, privacy, known gaps |
| [docs/refunds-and-reconciliation.md](docs/refunds-and-reconciliation.md) | Voids vs refunds vs reversals, maker-checker, reconciliation |
| [docs/testing.md](docs/testing.md) | Suites, scenario coverage, mock provider |
| [docs/deployment.md](docs/deployment.md) | Topology, environment variables, startup guards, backups |
| [docs/runbooks/](docs/runbooks/README.md) + [api/docs/alerts.md](api/docs/alerts.md) | Operations |
| [docs/requirements-traceability.md](docs/requirements-traceability.md) | Every PRD requirement → code, tests, status |
| [docs/provider-capability-matrix.md](docs/provider-capability-matrix.md) | What the partner can and cannot do, with evidence |
| [docs/open-questions.md](docs/open-questions.md) | Decisions needed from PM, partner and legal |
| [docs/production-readiness.md](docs/production-readiness.md) | Launch checklist |
| [docs/adr/](docs/adr/README.md) | Architecture decisions |
