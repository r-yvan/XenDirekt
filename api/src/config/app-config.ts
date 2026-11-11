import { AppEnvironment, Env } from './env.schema';

export interface CapabilityApproval {
  capability: string;
  evidence: string;
}

/**
 * Parses `CAPABILITY=evidence-reference` pairs separated by `;`.
 * Entries without evidence are rejected: an approval must point at something auditable.
 */
export function parseCapabilityApprovals(raw: string): CapabilityApproval[] {
  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const separator = entry.indexOf('=');
      const capability = (separator === -1 ? entry : entry.slice(0, separator)).trim();
      const evidence = separator === -1 ? '' : entry.slice(separator + 1).trim();
      if (!capability || !evidence) {
        throw new Error(
          `PROVIDER_CAPABILITY_APPROVALS entry "${capability || entry}" needs an evidence reference (CAPABILITY=reference)`,
        );
      }
      return { capability, evidence };
    });
}

/** Typed, read-only view of the validated environment. Inject this; never read process.env. */
export class AppConfig {
  readonly environment: AppEnvironment;
  readonly isProduction: boolean;
  /** local and test may use developer conveniences (inline worker, mock pages, dev bridges). */
  readonly isDevelopmentLike: boolean;

  readonly http: {
    port: number;
    publicBaseUrl: string;
    trustProxy: boolean;
    corsAllowedOrigins: string[];
    enableApiDocs: boolean;
  };
  /** The web portal and website; card setup and 3-D Secure return there for web sessions. */
  readonly web: { baseUrl: string; origin: string };
  readonly logLevel: Env['LOG_LEVEL'];
  readonly database: { url: string; poolMax: number; ssl: boolean };
  readonly redisUrl: string | undefined;
  readonly workerMode: Env['WORKER_MODE'];
  readonly auth: {
    accessSecret: string;
    adminSecret: string;
    accessTokenTtlSeconds: number;
    refreshTokenTtlDays: number;
    adminAccessTokenTtlSeconds: number;
    adminRefreshTokenTtlHours: number;
    otpHmacSecret: string;
    pinPepper: string;
    federatedSignIn: { enabled: boolean; googleClientIds: string[]; appleClientIds: string[] };
  };
  readonly encryption: { key: Buffer; keyId: string };
  readonly provider: {
    name: Env['PAYMENT_PROVIDER'];
    capabilityApprovals: CapabilityApproval[];
    xentripay: {
      baseUrl: string;
      apiKey: string | undefined;
      connectTimeoutMs: number;
      responseTimeoutMs: number;
    };
    mock: { latencyMs: number; webhookSecret: string | undefined };
    /** Hybrid only: national MSISDN (0788123456) → registered name, for real sandbox payouts. */
    hybridTestPayees: ReadonlyMap<string, string>;
  };
  readonly notifications: {
    email: {
      transport: Env['EMAIL_TRANSPORT'];
      host: string;
      port: number;
      secure: boolean;
      user: string | undefined;
      password: string | undefined;
      from: string;
    };
    smsTransport: Env['SMS_TRANSPORT'];
    pushTransport: Env['PUSH_TRANSPORT'];
  };
  readonly metricsToken: string | undefined;
  readonly features: { merchantCodes: boolean };
  readonly legal: {
    termsVersion: string;
    privacyVersion: string;
    termsUrl: string;
    privacyUrl: string;
  };

  constructor(env: Env) {
    this.environment = env.APP_ENV;
    this.isProduction = env.APP_ENV === 'production';
    this.isDevelopmentLike = env.APP_ENV === 'local' || env.APP_ENV === 'test';
    this.http = {
      port: env.PORT,
      publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/+$/, ''),
      trustProxy: env.TRUST_PROXY,
      corsAllowedOrigins: env.CORS_ALLOWED_ORIGINS,
      enableApiDocs: env.ENABLE_API_DOCS || this.isDevelopmentLike,
    };
    const webBaseUrl = env.WEB_APP_BASE_URL.replace(/\/+$/, '');
    this.web = { baseUrl: webBaseUrl, origin: new URL(webBaseUrl).origin };
    this.logLevel = env.LOG_LEVEL;
    this.database = {
      url: env.DATABASE_URL,
      poolMax: env.DATABASE_POOL_MAX,
      ssl: env.DATABASE_SSL === 'require',
    };
    this.redisUrl = env.REDIS_URL || undefined;
    this.workerMode = env.WORKER_MODE;
    this.auth = {
      accessSecret: env.JWT_ACCESS_SECRET,
      adminSecret: env.JWT_ADMIN_SECRET,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      adminAccessTokenTtlSeconds: env.ADMIN_ACCESS_TOKEN_TTL_SECONDS,
      adminRefreshTokenTtlHours: env.ADMIN_REFRESH_TOKEN_TTL_HOURS,
      otpHmacSecret: env.OTP_HMAC_SECRET,
      pinPepper: env.PIN_PEPPER,
      federatedSignIn: {
        enabled: env.FEATURE_FEDERATED_SIGN_IN,
        googleClientIds: env.GOOGLE_CLIENT_IDS,
        appleClientIds: env.APPLE_CLIENT_IDS,
      },
    };
    this.encryption = {
      key: Buffer.from(env.FIELD_ENCRYPTION_KEY, 'base64'),
      keyId: env.FIELD_ENCRYPTION_KEY_ID,
    };
    this.provider = {
      name: env.PAYMENT_PROVIDER,
      capabilityApprovals: parseCapabilityApprovals(env.PROVIDER_CAPABILITY_APPROVALS),
      xentripay: {
        baseUrl: env.XENTRIPAY_BASE_URL.replace(/\/+$/, ''),
        apiKey: env.XENTRIPAY_API_KEY || undefined,
        connectTimeoutMs: env.XENTRIPAY_CONNECT_TIMEOUT_MS,
        responseTimeoutMs: env.XENTRIPAY_RESPONSE_TIMEOUT_MS,
      },
      mock: {
        latencyMs: env.MOCK_PROVIDER_LATENCY_MS,
        webhookSecret: env.MOCK_WEBHOOK_SECRET || undefined,
      },
      hybridTestPayees: parseHybridTestPayees(env.HYBRID_TEST_PAYEES),
    };
    this.notifications = {
      email: {
        transport: env.EMAIL_TRANSPORT,
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER || undefined,
        password: env.SMTP_PASSWORD || undefined,
        from: env.EMAIL_FROM,
      },
      smsTransport: env.SMS_TRANSPORT,
      pushTransport: env.PUSH_TRANSPORT,
    };
    this.metricsToken = env.METRICS_TOKEN || undefined;
    this.features = { merchantCodes: env.FEATURE_MERCHANT_CODES };
    this.legal = {
      termsVersion: env.TERMS_VERSION,
      privacyVersion: env.PRIVACY_VERSION,
      termsUrl: env.TERMS_URL,
      privacyUrl: env.PRIVACY_URL,
    };
    Object.freeze(this);
  }

  /** The mock provider produces simulated results; it must never run where money is real. */
  /** True for the mock and for the hybrid (simulated cards, XentriPay payouts). */
  get usesSimulatedProvider(): boolean {
    return this.provider.name !== 'xentripay';
  }
}

/** Parses "0788123456=Jane Doe;0795000000=John Doe" into national MSISDN → name. */
export function parseHybridTestPayees(raw: string): ReadonlyMap<string, string> {
  const payees = new Map<string, string>();
  for (const entry of raw.split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const msisdn = entry.slice(0, separator).trim();
    const name = entry.slice(separator + 1).trim();
    if (!/^07[2389]\d{7}$/.test(msisdn) || !name) {
      throw new Error(
        `HYBRID_TEST_PAYEES entry "${entry.trim()}" must look like 0788123456=Full Name`,
      );
    }
    payees.set(msisdn, name);
  }
  return payees;
}
