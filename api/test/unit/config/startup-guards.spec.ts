import { AppConfig, parseCapabilityApprovals } from '../../../src/config/app-config';
import { parseEnv } from '../../../src/config/env.schema';
import { collectStartupProblems } from '../../../src/config/startup-guards';
import { testEnv } from '../../support/test-env';

const ALL_CRITICAL =
  'CARD_SETUP_TOKENISATION=EV-1;CARD_THREE_DS=EV-2;CARD_AUTHORISE=EV-3;CARD_CAPTURE=EV-4;CARD_VOID=EV-5;' +
  'CARD_REFUND=EV-6;PAYEE_NAME_LOOKUP_MTN=EV-7;PAYOUT_MTN_PHONE=EV-8;PAYOUT_STATUS=EV-9;SETTLEMENT_REPORTS=EV-10;' +
  'STATUS_WEBHOOKS=EV-11';

function productionEnv(overrides: Record<string, string> = {}): AppConfig {
  return new AppConfig(
    parseEnv(
      testEnv({
        APP_ENV: 'production',
        PAYMENT_PROVIDER: 'xentripay',
        XENTRIPAY_API_KEY: 'k',
        REDIS_URL: 'redis://redis:6379',
        DATABASE_SSL: 'require',
        METRICS_TOKEN: 'm',
        PUBLIC_BASE_URL: 'https://api.xendirekt.example',
        WORKER_MODE: 'separate',
        PROVIDER_CAPABILITY_APPROVALS: ALL_CRITICAL,
        ...overrides,
      }),
    ),
  );
}

describe('environment parsing', () => {
  it('rejects short secrets without echoing values', () => {
    expect(() => parseEnv(testEnv({ PIN_PEPPER: 'short' }))).toThrow(/PIN_PEPPER/);
    try {
      parseEnv(testEnv({ PIN_PEPPER: 'short-secret-value' }));
    } catch (error) {
      expect(String(error)).not.toContain('short-secret-value');
    }
  });

  it('requires evidence for every capability approval', () => {
    expect(parseCapabilityApprovals('CARD_VOID=EV-5; PAYOUT_STATUS=EV-9')).toEqual([
      { capability: 'CARD_VOID', evidence: 'EV-5' },
      { capability: 'PAYOUT_STATUS', evidence: 'EV-9' },
    ]);
    expect(() => parseCapabilityApprovals('CARD_VOID')).toThrow(/evidence/);
  });
});

describe('startup guards', () => {
  it('accepts a fully approved production configuration', () => {
    expect(collectStartupProblems(productionEnv())).toEqual([]);
  });

  it('forbids the mock provider in production', () => {
    const problems = collectStartupProblems(productionEnv({ PAYMENT_PROVIDER: 'mock' }));
    expect(problems.join('\n')).toContain('PAYMENT_PROVIDER=mock is forbidden in production');
  });

  it('forbids the hybrid (simulated cards + XentriPay payouts) in production', () => {
    const problems = collectStartupProblems(productionEnv({ PAYMENT_PROVIDER: 'hybrid' }));
    expect(problems.join('\n')).toContain('PAYMENT_PROVIDER=hybrid is forbidden in production');
  });

  it('refuses production when the capability checklist is incomplete', () => {
    const problems = collectStartupProblems(
      productionEnv({ PROVIDER_CAPABILITY_APPROVALS: 'PAYOUT_STATUS=EV-9' }),
    );
    expect(problems.join('\n')).toMatch(/missing approval evidence for: CARD_SETUP_TOKENISATION/);
    expect(problems.join('\n')).toMatch(/STATUS_WEBHOOKS/);
  });

  it('requires merchant-code approval when the feature is on', () => {
    const problems = collectStartupProblems(productionEnv({ FEATURE_MERCHANT_CODES: 'true' }));
    expect(problems.join('\n')).toContain('PAYOUT_MTN_MERCHANT_CODE');
  });

  it('accepts polling instead of webhooks only with an explicit approval', () => {
    const approvals = ALL_CRITICAL.replace(
      ';STATUS_WEBHOOKS=EV-11',
      ';STATUS_POLLING_ACCEPTED=PM-2026-11',
    );
    expect(
      collectStartupProblems(productionEnv({ PROVIDER_CAPABILITY_APPROVALS: approvals })),
    ).toEqual([]);
  });

  it('requires shared infrastructure and TLS in production', () => {
    const problems = collectStartupProblems(
      productionEnv({
        REDIS_URL: '',
        DATABASE_SSL: 'disable',
        PUBLIC_BASE_URL: 'http://api.example',
        METRICS_TOKEN: '',
      }),
    ).join('\n');
    expect(problems).toContain('REDIS_URL');
    expect(problems).toContain('DATABASE_SSL');
    expect(problems).toContain('https');
    expect(problems).toContain('METRICS_TOKEN');
  });

  it('rejects developer conveniences outside local and test', () => {
    const config = new AppConfig(
      parseEnv(
        testEnv({ APP_ENV: 'staging', WORKER_MODE: 'inline', SMS_TRANSPORT: 'dev-email-bridge' }),
      ),
    );
    const problems = collectStartupProblems(config).join('\n');
    expect(problems).toContain('WORKER_MODE=inline');
    expect(problems).toContain('dev-email-bridge');
  });

  it('rejects unknown capability names', () => {
    const config = new AppConfig(
      parseEnv(testEnv({ PROVIDER_CAPABILITY_APPROVALS: 'TELEPORT=EV-1' })),
    );
    expect(collectStartupProblems(config)).toEqual([
      'Unknown capability in PROVIDER_CAPABILITY_APPROVALS: TELEPORT',
    ]);
  });
});
