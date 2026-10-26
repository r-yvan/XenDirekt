# ADR 0008: MTN MoMo only payee routing

## Context

The PRD includes MTN and Airtel with a manual network override (FR-PAY-02). The implementation
brief restricts v1.0 to MTN MoMo and forbids an override that enables an unsupported network.

## Decision

- The only payout network is `MTN`. Prefix routing comes from versioned configuration (default:
  MTN national prefixes `78` and `79`). Any other Rwandan mobile prefix returns
  `NETWORK_NOT_SUPPORTED`. The user is told XenDirekt supports MTN MoMo only, and no other
  network is named.
- There is no network toggle or override in the API or the app.
- The provider's name lookup is authoritative. Prefix routing is only a first filter, because
  numbers can be ported between networks.
- MoMo Pay merchant codes are behind a feature flag (`payee.merchantCodes`) that is off by
  default and needs provider approval before it can be enabled in production.

## Consequences

- FR-PAY-02 and acceptance criterion AC-1 are partially descoped (OQ-20).
- Adding a network later means a configuration change, a migration that extends the
  `payee_network` check, and provider confirmation.
