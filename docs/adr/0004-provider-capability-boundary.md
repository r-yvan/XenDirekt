# ADR 0004: Provider capability boundary and real-money gate

## Context

The PRD flow needs card tokenisation, 3-D Secure, separate authorise/capture/void, MoMo
name lookup, unattended payouts, signed webhooks, refunds and settlement files. The supplied
XentriPay documentation confirms only payouts (which need a manual OTP per payout) and payout
status (see `docs/provider-capability-matrix.md`).

## Decision

- Domain code depends on a `PaymentProvider` port, never on XentriPay types. Provider payloads
  are mapped explicitly into internal types, and responses are validated before use.
- Each adapter declares a **capability set**. Calling an undeclared capability raises
  `CapabilityNotConfiguredError`, which the API returns as `CAPABILITY_NOT_CONFIGURED`.
  Nothing is simulated silently.
- `MockPaymentProvider` implements every capability deterministically for local development and
  tests. Config validation **rejects it when `APP_ENV=production`**. Every record it produces is
  stored with `is_simulated = true`, and the app shows a "Sandbox: no real money moves" banner.
- `XentriPayProvider` implements only the documented payout initiation and payout status calls.
  Collections and checkout are deliberately not used, because they charge immediately and
  collect in the opposite direction.
- **Real-money gate:** with `APP_ENV=production`, startup fails unless every critical capability
  is listed in `PROVIDER_CAPABILITY_APPROVALS` with an evidence reference, and the active fee,
  limit and FX configurations are approved.
- The webhook endpoint accepts only events whose signature scheme is implemented for the active
  provider. XentriPay has none, so its events are rejected. The mock provider has its own
  HMAC-signed test contract so the ingestion pipeline (signatures, replay window, deduplication)
  is fully tested.

## Consequences

- The whole product can be built and demonstrated end to end in development and test, but it
  cannot move real money until the partner gaps close.
- Adding a confirmed provider means writing a new adapter plus contract tests. No domain change
  is needed.
