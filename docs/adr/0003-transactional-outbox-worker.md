# ADR 0003: Transactional outbox and database-backed worker

## Context

A committed state change must never lose its follow-up work: authorising, paying out,
capturing, voiding, polling and notifying. Provider calls must never run inside an open
database transaction. Redis alone cannot guarantee durability.

## Decision

- Every state change that needs follow-up work inserts an `outbox_events` row **in the same
  transaction** as the change.
- Worker processes claim due rows with `SELECT … FOR UPDATE SKIP LOCKED`, mark them
  `PROCESSING` with a lease (`locked_until`) and commit before doing any remote work.
- On success a row becomes `DONE`. On a retryable error it returns to `PENDING` with exponential
  backoff plus full jitter. After `max_attempts` it becomes `DEAD`, which raises a metric and an alert.
- If a worker crashes, its lease expires and another worker reclaims the row. Delivery is
  therefore **at least once**, and every handler is idempotent.
- Financial handlers write their intent first: they record the operation (with a stable
  provider reference) and move the state forward in one short transaction, commit, then call the
  provider. A retried handler that finds an operation already recorded **queries status**
  instead of calling the provider again.
- Periodic jobs (stale-payment sweeper, reconciliation) run under PostgreSQL advisory locks, so
  only one instance runs each job at a time.

## Consequences

- No extra infrastructure. PostgreSQL provides durability and coordination.
- Throughput is enough for a pilot. A dedicated queue can replace the dispatcher later without
  changing handlers.
- Handlers have to be written for at-least-once delivery. Tests cover duplicate delivery and
  crash-after-provider-call cases.
