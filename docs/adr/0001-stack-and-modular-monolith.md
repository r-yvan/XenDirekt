# ADR 0001: Stack, monorepo and modular monolith

## Context

The brief prefers Flutter, NestJS/TypeScript, PostgreSQL and Redis, built in a monorepo with
`/android-ios` and `/api` now and `/web` later. The repository was empty apart from Satoshi font
files and an empty `/web` folder. The PRD (§7) recommends the same stack.

## Decision

- **Mobile:** Flutter (stable 3.47, Dart 3.13), one codebase for Android 9+ and iOS 15+.
  Riverpod for state, go_router for navigation, Dio for HTTP, flutter_secure_storage for
  secrets, local_auth for biometrics, gen-l10n for English and French.
- **Backend:** NestJS 12 on Node.js (developed on Node 26), TypeScript 6.0 in strict mode.
  TypeScript 7 is not used yet because the NestJS 12 CLI and typescript-eslint support only up to 6.0.
- **Shape:** a **modular monolith**. One deployable API image runs in two roles: `api` (HTTP)
  and `worker` (outbox and schedulers). Modules talk through injected services, never through
  each other's tables.
- **Data:** PostgreSQL is the source of truth for everything durable, including idempotency.
  Redis is used only for rate limiting. Tests and local runs without Redis fall back to an
  in-memory store; production config requires `REDIS_URL`.
- **Web:** not built in this phase. The admin API is versioned and documented so a later web
  client can use it.

## Consequences

- One codebase to secure, deploy and observe during the pilot. Modules can be split out later
  along their existing boundaries.
- The worker role can scale separately from HTTP without becoming a separate codebase.
- Redis being optional removes a hard dependency for development and tests. Rate limits are not
  shared across instances unless Redis is configured, which is why production requires it.
