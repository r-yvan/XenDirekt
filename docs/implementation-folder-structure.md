# Implementation folder structure

Status: planned in Phase 0, kept up to date as phases land.
Scope: `/android-ios` (Flutter) and `/api` (NestJS). `/web` is reserved for a later phase and is
not created or populated by this work. An empty `/web` directory already existed before Phase 0;
it is left untouched.

## Repository root

```text
/
├── android-ios/        # Flutter app for Android and iOS
├── api/                # NestJS REST backend
├── web/                # reserved, NOT populated in this phase (pre-existing, empty)
├── reference-docs/     # supplied PDFs, read-only
├── docs/               # architecture, ADRs, traceability, runbooks
├── .github/workflows/  # CI (lint, typecheck, tests, secret scan)
├── docker-compose.yml  # local PostgreSQL, Redis, Mailpit, API
└── README.md
```

## Flutter app (`/android-ios`)

```text
android-ios/
├── android/                         # generated; minSdk 28 (Android 9), FLAG_SECURE channel
├── ios/                             # generated; deployment target iOS 15
├── assets/
│   ├── fonts/satoshi/               # moved from android-ios/fonts/satoshi (supplied by the team)
│   ├── icons/
│   └── images/
├── lib/
│   ├── main.dart                    # bootstrap: config from --dart-define, ProviderScope
│   ├── app/
│   │   ├── app.dart                 # MaterialApp.router, theme, localisation, app-lock overlay
│   │   ├── router/                  # go_router: auth redirects, 3-tab shell, deep links
│   │   ├── theme/                   # PRD colour tokens, Satoshi typography, ThemeData
│   │   └── localization/            # ARB files (en, fr) and generated AppLocalizations
│   ├── core/
│   │   ├── config/                  # AppConfig (API base URL, environment, certificate pins)
│   │   ├── errors/                  # ApiFailure, server error code -> localised message
│   │   ├── network/                 # Dio client, auth refresh, request IDs, error mapping
│   │   ├── security/                # app lock, biometrics, device key, screenshot guard, pinning
│   │   ├── storage/                 # secure storage (tokens, install ID, device key)
│   │   ├── widgets/                 # buttons, amount text, status chip, state views, logo
│   │   └── utils/                   # RWF/currency formatting, Kigali time, masking
│   ├── shared/
│   │   ├── models/                  # PaymentState, Money, shared DTO models
│   │   └── components/              # sheet scaffolds, section headers
│   └── features/
│       ├── onboarding/              # splash, welcome
│       ├── authentication/          # OTP, session, PIN setup, lock screen, step-up
│       ├── profile/                 # profile screen, complete profile, delete account
│       ├── cards/                   # list, add (hosted page), default, remove with undo
│       ├── payee_lookup/            # identifier input, debounced lookup, recent payees
│       ├── quotes/                  # live quote controller and summary
│       ├── payments/                # Pay screen, execution, 3-D Secure, processing/result
│       ├── history/                 # history list with status filter
│       ├── receipts/                # receipt detail and share
│       ├── notifications/           # in-app inbox, push registration when configured
│       ├── support/                 # FAQ, report a problem, my tickets
│       └── settings/                # language, biometrics toggle, change PIN
├── test/
│   ├── unit/
│   ├── widget/
│   └── integration/                 # multi-screen flows against a fake API (no device)
├── integration_test/                # on-device tests (need an emulator or device)
├── .env.example                     # documents --dart-define keys, no secrets
├── analysis_options.yaml
├── l10n.yaml
├── pubspec.yaml
└── README.md
```

Substantial features use `data/` (API client, repository), `domain/` (models, pure logic) and
`presentation/` (screens, widgets, controllers). Small features skip layers they do not need;
no empty boilerplate files are created to match the tree.

## NestJS backend (`/api`)

```text
api/
├── src/
│   ├── main.ts                      # HTTP process bootstrap
│   ├── worker.ts                    # worker process entry (outbox + schedulers)       [addition]
│   ├── app.module.ts
│   ├── config/                      # zod env schema, typed config, production start guards
│   ├── common/
│   │   ├── decorators/              # @Public, @CurrentUser, @AdminRoles, @RateLimit, @StepUp
│   │   ├── filters/                 # global error envelope
│   │   ├── guards/                  # user auth, admin auth, roles, rate limit
│   │   ├── interceptors/            # request context, correlation IDs
│   │   ├── pipes/                   # validation pipe
│   │   ├── errors/                  # AppError and stable machine-readable codes
│   │   └── logging/                 # pino config, redaction, masking
│   ├── database/
│   │   ├── migrations/              # Kysely migrations written as explicit SQL
│   │   ├── seeds/                   # NON-PRODUCTION seed data only
│   │   ├── schema.ts                # Kysely table types
│   │   └── database.module.ts
│   ├── modules/
│   │   ├── auth/                    # OTP, sessions, refresh rotation, PIN, step-up, device keys
│   │   ├── users/                   # profile, deletion and anonymisation
│   │   ├── consents/                # timestamped Terms and Privacy acceptance
│   │   ├── cards/                   # setup sessions, eligibility rules, card management
│   │   ├── payees/                  # normalisation, MTN prefix routing, lookup, recents
│   │   ├── quotes/                  # fee and FX calculation, limits, quote lifecycle
│   │   ├── payments/                # state machine, orchestration, idempotency, receipts
│   │   ├── provider/                # provider port, capability registry, mock + XentriPay
│   │   ├── webhooks/                # inbound partner events (disabled for XentriPay)
│   │   ├── refunds/                 # void / refund / reversal adjustments, maker-checker
│   │   ├── reconciliation/          # daily runs, matching, discrepancy review, export
│   │   ├── risk/                    # rules, flags, blocklist, review queue
│   │   ├── notifications/           # templates, SMS / email / push / in-app channels
│   │   ├── tickets/                 # support tickets
│   │   ├── audit/                   # append-only audit log
│   │   ├── health/                  # liveness, readiness, metrics
│   │   ├── admin/                   # admin identity: login + TOTP, roles             [addition]
│   │   ├── configuration/           # versioned fees, limits, BINs, FX, feature flags  [addition]
│   │   └── analytics/               # PII-free product events                          [addition]
│   ├── jobs/                        # outbox worker, payment sweeper, schedulers
│   └── shared/                      # domain primitives: money, currency, phone, references, crypto
├── test/
│   ├── unit/
│   ├── integration/                 # real PostgreSQL (database name must end in _test)
│   ├── contract/                    # provider adapter tests against documented payloads
│   └── e2e/                         # HTTP scenarios with the mock provider
├── docs/                            # backend docs, provider integration notes, OpenAPI export
├── scripts/                         # create-admin, export-openapi, migrate, seed
├── .env.example
├── nest-cli.json
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── README.md
```

Each module separates controllers and DTOs, application services, pure domain logic
(`domain/`), persistence (`*.repository.ts`) and, where relevant, provider mapping.
Admin endpoints for a feature live in that feature's module under `/v1/admin/...`
(for example `payments/admin-payments.controller.ts`), so authorisation rules stay next
to the domain they protect.

## Deviations from the requested trees, and why

| Deviation | Reason |
|---|---|
| `api/src/worker.ts` | Background work runs as its own process in production so HTTP latency is not affected by provider polling. Local development can run it in the API process. |
| `modules/admin` | The PRD's admin roles need an identity store, login, TOTP 2FA and role management separate from tourist accounts. |
| `modules/configuration` | FR-ADM-05 needs versioned, audited fees, limits and blocked BINs that change without a release. |
| `modules/analytics` | PRD §10.1 events must be captured without personal data; this module enforces an allowlist. |
| `database/schema.ts` | Kysely needs a typed description of the tables; a drift test checks it against the migrated database. |
| `.github/workflows/` at the root | CI has to live there for GitHub Actions. |
| `assets/fonts/satoshi/` | Moved from `android-ios/fonts/satoshi/` (supplied by the team) to match the requested `assets/fonts/` location. |
