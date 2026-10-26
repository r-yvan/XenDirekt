# ADR 0006: Money, FX and rounding

## Context

All money must be integer minor units with an explicit currency, and floating point must never
be used for money. RWF has no minor unit. The fee model, FX source and rounding policy are open
(OQ-02, OQ-28).

## Decision

- `Money` is a value object holding `amountMinor: bigint` and an ISO 4217 `currency`, with
  exponents from a fixed table (RWF 0, USD/EUR/GBP 2, …). Mixing currencies throws.
- PostgreSQL stores money as `bigint` and currency as `char(3)`. JSON carries integers,
  bounded far below 2^53 by validation.
- **FX rate** = RWF per one major unit of the card currency, stored as `numeric(20,8)` and handled
  as a scaled `bigint` (×10^8). Display: "1 USD = 1,450.25 RWF".
- **Card total** = `ceil((amount_rwf + fee_rwf) × 10^exp(card) / rate)`, computed in integers.
  Rounding **up** (proposed default) ensures the collected amount always covers the payout
  plus the fee.
- **Fee** = `fixed_rwf + ceil(amount_rwf × bps / 10,000)`, clamped to `[min_fee, max_fee]`, in
  whole RWF.
- Fee, limits and FX values come from versioned configuration records with an `approved` flag.
  Production quoting refuses unapproved records.
- Quotes freeze every input (rate, fee config version, rounding mode) so a receipt can always be
  explained afterwards.

## Consequences

- Results are exact and reproducible, and boundary tests cover rounding.
- When the PM approves a different rounding policy, only the quote calculator changes.
