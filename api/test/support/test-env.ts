import { randomBytes } from 'node:crypto';
import { AppConfig } from '../../src/config/app-config';
import { parseEnv } from '../../src/config/env.schema';
import { TEST_DATABASE_URL } from './test-database';

/** Throwaway secrets generated per test run; nothing here is ever a real credential. */
const generated = {
  JWT_ACCESS_SECRET: randomBytes(32).toString('base64url'),
  JWT_ADMIN_SECRET: randomBytes(32).toString('base64url'),
  OTP_HMAC_SECRET: randomBytes(32).toString('base64url'),
  PIN_PEPPER: randomBytes(32).toString('base64url'),
  FIELD_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  MOCK_WEBHOOK_SECRET: randomBytes(32).toString('base64url'),
};

export function testEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    APP_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    LOG_LEVEL: 'silent',
    WORKER_MODE: 'disabled',
    PAYMENT_PROVIDER: 'mock',
    MOCK_PROVIDER_LATENCY_MS: '0',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    ...generated,
    ...overrides,
  };
}

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return new AppConfig(parseEnv(testEnv(overrides)));
}
