import type { ProviderCapability } from './capabilities';

/**
 * Failure classes the orchestrator must treat differently (brief §7.1):
 * - Unreachable: the request provably never reached the provider (DNS, refused, TLS) → safe to retry.
 * - OutcomeUnknown: it may have been processed (timeout after send, 5xx, unreadable response)
 *   → never resend a money-moving call; reconcile by status.
 * - Rejected: the provider answered with a definite refusal (validation, 4xx) → nothing happened.
 */
export class ProviderError extends Error {}

export class ProviderUnreachableError extends ProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderUnreachableError';
  }
}

export class ProviderOutcomeUnknownError extends ProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderOutcomeUnknownError';
  }
}

export class ProviderRejectedError extends ProviderError {
  constructor(
    message: string,
    readonly providerCode: string | null,
  ) {
    super(message);
    this.name = 'ProviderRejectedError';
  }
}

export class CapabilityNotConfiguredError extends ProviderError {
  constructor(readonly capability: ProviderCapability) {
    super(`Provider capability not configured: ${capability}`);
    this.name = 'CapabilityNotConfiguredError';
  }
}
