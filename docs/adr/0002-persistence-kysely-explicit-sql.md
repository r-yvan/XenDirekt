# ADR 0002: Persistence with PostgreSQL, Kysely and explicit SQL migrations

## Context

Payment correctness depends on database guarantees: row locks (`SELECT … FOR UPDATE`),
`SKIP LOCKED` job claiming, partial unique indexes (for example "at most one payout per payment"),
CHECK constraints and short explicit transactions. The brief asks for one ORM and migration
approach used consistently.

## Decision

- Use **Kysely** (type-safe SQL query builder) over the `pg` driver.
- Write migrations by hand as **explicit SQL** in Kysely migration files under
  `api/src/database/migrations/`, registered in order in a static index. No auto-generated
  migrations, and no runtime schema synchronisation.
- Describe table types in `api/src/database/schema.ts`. An integration test compares those types
  with `information_schema` after migrating, so drift fails CI.
- Repositories take an executor (`Kysely` or `Transaction`) so services can compose several
  writes into one short transaction.
- PostgreSQL `bigint` money columns are parsed into JavaScript `bigint`, never `number`.

## Consequences

- Every invariant is visible in SQL and enforced by the database, so it holds under concurrency.
- More hand-written code than an entity ORM, offset by no hidden lazy loading, no change
  tracking and no implicit transactions.
- Developers need to read SQL. That is deliberate for a payment system.
