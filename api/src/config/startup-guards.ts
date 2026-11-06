import {
  CRITICAL_LIVE_CAPABILITIES,
  STATUS_POLLING_ACCEPTED,
  isProviderCapability,
} from '../modules/provider/domain/capabilities';
import { AppConfig } from './app-config';

/**
 * Refuses unsafe combinations before the process accepts traffic. Returns the list of problems so
 * tests can assert on them; `enforceStartupGuards` throws when the list is not empty.
 */
export function collectStartupProblems(config: AppConfig): string[] {
  const problems: string[] = [];

  // Template placeholders copied from .env.example must never run, in any environment.
  const secrets: Record<string, string> = {
    JWT_ACCESS_SECRET: config.auth.accessSecret,
    JWT_ADMIN_SECRET: config.auth.adminSecret,
    OTP_HMAC_SECRET: config.auth.otpHmacSecret,
    PIN_PEPPER: config.auth.pinPepper,
  };
  for (const [name, value] of Object.entries(secrets)) {
    if (value.startsWith('replace-with')) {
      problems.push(`${name} still holds the .env.example placeholder; generate a random value`);
    }
  }
  if (config.encryption.key.every((byte) => byte === 0)) {
    problems.push(
      'FIELD_ENCRYPTION_KEY is all zeros (template placeholder); generate a random key',
    );
  }
  if (new Set(Object.values(secrets)).size !== Object.keys(secrets).length) {
    problems.push(
      'JWT_ACCESS_SECRET, JWT_ADMIN_SECRET, OTP_HMAC_SECRET and PIN_PEPPER must all differ',
    );
  }

  for (const approval of config.provider.capabilityApprovals) {
    if (
      !isProviderCapability(approval.capability) &&
      approval.capability !== STATUS_POLLING_ACCEPTED
    ) {
      problems.push(`Unknown capability in PROVIDER_CAPABILITY_APPROVALS: ${approval.capability}`);
    }
  }

  // Developer conveniences are only allowed where no real customer or money can be involved.
  if (!config.isDevelopmentLike) {
    if (config.workerMode === 'inline') {
      problems.push('WORKER_MODE=inline is only allowed in local and test environments');
    }
    if (config.notifications.email.transport === 'dev-inbox') {
      problems.push('EMAIL_TRANSPORT=dev-inbox is only allowed in local and test environments');
    }
    if (config.notifications.smsTransport === 'dev-email-bridge') {
      problems.push(
        'SMS_TRANSPORT=dev-email-bridge is only allowed in local and test environments',
      );
    }
  }

  if (!config.isProduction) {
    return problems;
  }

  if (config.usesSimulatedProvider) {
    problems.push(
      `PAYMENT_PROVIDER=${config.provider.name} is forbidden in production (simulated results)`,
    );
  }
  if (!config.redisUrl) {
    problems.push('REDIS_URL is required in production (shared rate limits)');
  }
  if (!config.database.ssl) {
    problems.push('DATABASE_SSL=require is required in production');
  }
  if (!config.metricsToken) {
    problems.push('METRICS_TOKEN is required in production');
  }
  if (!config.http.publicBaseUrl.startsWith('https://')) {
    problems.push('PUBLIC_BASE_URL must use https in production');
  }
  if (config.http.enableApiDocs) {
    problems.push('ENABLE_API_DOCS must be false in production');
  }
  if (config.provider.name === 'xentripay' && !config.provider.xentripay.apiKey) {
    problems.push('XENTRIPAY_API_KEY is required when PAYMENT_PROVIDER=xentripay');
  }

  const approved = new Set(config.provider.capabilityApprovals.map((entry) => entry.capability));
  const missing = CRITICAL_LIVE_CAPABILITIES.filter((capability) => !approved.has(capability));
  if (config.features.merchantCodes && !approved.has('PAYOUT_MTN_MERCHANT_CODE')) {
    missing.push('PAYOUT_MTN_MERCHANT_CODE');
  }
  if (missing.length > 0) {
    problems.push(
      `Provider capability checklist incomplete; missing approval evidence for: ${missing.join(', ')}`,
    );
  }
  if (!approved.has('STATUS_WEBHOOKS') && !approved.has(STATUS_POLLING_ACCEPTED)) {
    problems.push(
      `Approve STATUS_WEBHOOKS, or record ${STATUS_POLLING_ACCEPTED} if polling plus reconciliation is accepted`,
    );
  }

  return problems;
}

export function enforceStartupGuards(config: AppConfig): void {
  const problems = collectStartupProblems(config);
  if (problems.length > 0) {
    throw new Error(
      `Refusing to start (${config.environment}):\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
}
