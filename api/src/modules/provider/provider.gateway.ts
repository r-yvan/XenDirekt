import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { AppConfig } from '../../config/app-config';
import { MetricsService } from '../health/metrics.service';
import { ProviderCapability } from './domain/capabilities';
import {
  CapabilityNotConfiguredError,
  ProviderOutcomeUnknownError,
  ProviderRejectedError,
  ProviderUnreachableError,
} from './domain/provider-errors';
import { PAYMENT_PROVIDER, type PaymentProvider } from './domain/payment-provider';

/**
 * The only way application code reaches the partner. Enforces the capability boundary
 * (ADR 0004): a capability is usable when the adapter implements it AND it is either simulated
 * (mock, non-production only) or approved with evidence in PROVIDER_CAPABILITY_APPROVALS.
 * Also records latency and error metrics per operation.
 */
@Injectable()
export class ProviderGateway {
  private readonly logger = new Logger(ProviderGateway.name);
  private readonly approved: ReadonlySet<string>;

  constructor(
    @Inject(PAYMENT_PROVIDER) readonly provider: PaymentProvider,
    private readonly config: AppConfig,
    private readonly metrics: MetricsService,
  ) {
    this.approved = new Set(config.provider.capabilityApprovals.map((entry) => entry.capability));
  }

  get name(): string {
    return this.provider.name;
  }

  get simulated(): boolean {
    return this.provider.simulated;
  }

  isUsable(capability: ProviderCapability): boolean {
    if (!this.provider.implemented.has(capability)) {
      return false;
    }
    const simulated = this.provider.isSimulatedCapability?.(capability) ?? this.provider.simulated;
    return simulated ? !this.config.isProduction : this.approved.has(capability);
  }

  /** Runs a provider call behind its capability, with metrics. Provider errors propagate typed. */
  async call<T>(
    capability: ProviderCapability,
    operation: string,
    fn: (provider: PaymentProvider) => Promise<T>,
  ): Promise<T> {
    if (!this.isUsable(capability)) {
      throw new CapabilityNotConfiguredError(capability);
    }
    const end = this.metrics.providerDuration.startTimer({
      provider: this.provider.name,
      operation,
    });
    try {
      const result = await fn(this.provider);
      end({ outcome: 'ok' });
      return result;
    } catch (error) {
      const kind =
        error instanceof ProviderUnreachableError
          ? 'unreachable'
          : error instanceof ProviderOutcomeUnknownError
            ? 'unknown_outcome'
            : error instanceof ProviderRejectedError
              ? 'rejected'
              : 'error';
      end({ outcome: kind });
      this.metrics.providerErrors.inc({ provider: this.provider.name, operation, kind });
      this.logger.warn({ operation, kind, err: error }, 'Provider call failed');
      throw error;
    }
  }

  /** For request/response API paths: maps provider failures to client-safe AppErrors. */
  async callForClient<T>(
    capability: ProviderCapability,
    operation: string,
    fn: (provider: PaymentProvider) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.call(capability, operation, fn);
    } catch (error) {
      if (error instanceof CapabilityNotConfiguredError) {
        throw new AppError('CAPABILITY_NOT_CONFIGURED', undefined, {
          capability: error.capability,
        });
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('PROVIDER_UNAVAILABLE');
    }
  }
}
