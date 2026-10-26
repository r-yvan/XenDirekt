import { z } from 'zod';

/**
 * Environment contract. Every variable the API reads is declared here; anything else is ignored.
 * Secrets have no defaults. Non-secret defaults are safe for local development only, and
 * `assertProductionReadiness` re-checks the values that matter before a production start.
 */

const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

const csv = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  );

/** At least 32 bytes of entropy, expressed as base64/base64url or any string of 43+ characters. */
const secret = z.string().min(43, 'must be at least 43 characters (32 random bytes, base64)');

export const APP_ENVIRONMENTS = ['local', 'test', 'sandbox', 'staging', 'production'] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export const envSchema = z.object({
  APP_ENV: z.enum(APP_ENVIRONMENTS).default('local'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: booleanFlag,
  CORS_ALLOWED_ORIGINS: csv,
  ENABLE_API_DOCS: booleanFlag,

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_SSL: z.enum(['disable', 'require']).default('disable'),
  REDIS_URL: z.string().optional(),

  /** inline: worker loops run inside the API process (local/test only). */
  WORKER_MODE: z.enum(['inline', 'separate', 'disabled']).default('inline'),

  JWT_ACCESS_SECRET: secret,
  JWT_ADMIN_SECRET: secret,
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  ADMIN_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  ADMIN_REFRESH_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(12),
  OTP_HMAC_SECRET: secret,
  PIN_PEPPER: secret,
  FIELD_ENCRYPTION_KEY: z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
    message: 'must be 32 bytes encoded as base64',
  }),
  FIELD_ENCRYPTION_KEY_ID: z
    .string()
    .regex(/^[a-z0-9-]{1,16}$/)
    .default('k1'),

  PAYMENT_PROVIDER: z.enum(['mock', 'xentripay']).default('mock'),
  XENTRIPAY_BASE_URL: z.url().default('https://merchant.test.xentripay.com'),
  XENTRIPAY_API_KEY: z.string().optional(),
  XENTRIPAY_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500).max(30000).default(3000),
  XENTRIPAY_RESPONSE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  /** `CAPABILITY=evidence-reference` pairs separated by `;`. Only meaningful for real providers. */
  PROVIDER_CAPABILITY_APPROVALS: z.string().default(''),
  MOCK_PROVIDER_LATENCY_MS: z.coerce.number().int().min(0).max(10000).default(150),
  MOCK_WEBHOOK_SECRET: z.string().optional(),

  /** dev-inbox: messages kept in memory and readable at GET /dev/inbox (local/test only). */
  EMAIL_TRANSPORT: z.enum(['smtp', 'dev-inbox', 'disabled']).default('disabled'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_SECURE: booleanFlag,
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('XenDirekt <no-reply@xendirekt.local>'),
  /** dev-email-bridge delivers SMS text to the SMTP sink (Mailpit) for local development only. */
  SMS_TRANSPORT: z.enum(['disabled', 'dev-email-bridge']).default('disabled'),
  PUSH_TRANSPORT: z.enum(['disabled']).default('disabled'),

  METRICS_TOKEN: z.string().optional(),

  FEATURE_MERCHANT_CODES: booleanFlag,
  FEATURE_FEDERATED_SIGN_IN: booleanFlag,
  GOOGLE_CLIENT_IDS: csv,
  APPLE_CLIENT_IDS: csv,

  TERMS_VERSION: z.string().min(1).default('2026-10-01'),
  PRIVACY_VERSION: z.string().min(1).default('2026-10-01'),
  TERMS_URL: z.url().default('https://xendirekt.example/terms'),
  PRIVACY_URL: z.url().default('https://xendirekt.example/privacy'),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // Only variable names and rule messages are reported, never values.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}
