import { AppConfig, parseHybridTestPayees } from '../../../src/config/app-config';
import { parseEnv } from '../../../src/config/env.schema';
import { MetricsService } from '../../../src/modules/health/metrics.service';
import { HybridPaymentProvider } from '../../../src/modules/provider/hybrid/hybrid-payment.provider';
import { MockPaymentProvider } from '../../../src/modules/provider/mock/mock-payment.provider';
import { ProviderGateway } from '../../../src/modules/provider/provider.gateway';
import { XentriPayHttpClient } from '../../../src/modules/provider/xentripay/xentripay-http.client';
import { XentriPayPaymentProvider } from '../../../src/modules/provider/xentripay/xentripay-payment.provider';
import { testEnv } from '../../support/test-env';

function hybrid(testPayees: ReadonlyMap<string, string> = new Map()) {
  const http = new XentriPayHttpClient({
    baseUrl: 'https://merchant.test.xentripay.com',
    apiKey: 'test-key',
    responseTimeoutMs: 1000,
  });
  const xentripay = new XentriPayPaymentProvider(http);
  return {
    provider: new HybridPaymentProvider(
      new MockPaymentProvider('http://localhost'),
      xentripay,
      testPayees,
    ),
    xentripay,
  };
}

function gateway(provider: HybridPaymentProvider, approvals = '') {
  const config = new AppConfig(
    parseEnv(testEnv({ PAYMENT_PROVIDER: 'hybrid', PROVIDER_CAPABILITY_APPROVALS: approvals })),
  );
  return new ProviderGateway(provider, config, new MetricsService());
}

describe('hybrid provider (simulated cards, XentriPay payouts)', () => {
  it('lets the simulated card steps run outside production without approvals', () => {
    const { provider } = hybrid();
    const g = gateway(provider);
    for (const capability of [
      'CARD_SETUP_TOKENISATION',
      'CARD_AUTHORISE',
      'CARD_CAPTURE',
      'PAYEE_NAME_LOOKUP_MTN',
    ] as const) {
      expect(g.isUsable(capability)).toBe(true);
    }
  });

  it('treats XentriPay payouts as real: unusable until approved with evidence', () => {
    const { provider } = hybrid();
    expect(gateway(provider).isUsable('PAYOUT_MTN_PHONE')).toBe(false);
    const approved = gateway(provider, 'PAYOUT_MTN_PHONE=sandbox-test;PAYOUT_STATUS=sandbox-test');
    expect(approved.isUsable('PAYOUT_MTN_PHONE')).toBe(true);
    expect(approved.isUsable('PAYOUT_STATUS')).toBe(true);
  });

  it('sends payouts and status checks to XentriPay, not the mock', async () => {
    const { provider, xentripay } = hybrid();
    const status = jest
      .spyOn(xentripay, 'getPayoutStatus')
      .mockResolvedValue({ status: 'PENDING', providerRef: null, raw: 'PENDING' });
    await expect(provider.getPayoutStatus('XD-ABCDEF-PO')).resolves.toMatchObject({
      status: 'PENDING',
    });
    expect(status).toHaveBeenCalledWith('XD-ABCDEF-PO');
  });

  it('marks everything it produces as simulated (no real card money moves)', () => {
    expect(hybrid().provider.simulated).toBe(true);
  });

  it("returns a tester's real registered name so XentriPay's name check passes", async () => {
    const { provider } = hybrid(parseHybridTestPayees('0788000111=Jane Tester'));
    await expect(
      provider.lookupPayee({
        network: 'MTN',
        identifierType: 'PHONE',
        identifier: '+250788000111',
      }),
    ).resolves.toEqual({ status: 'FOUND', registeredName: 'Jane Tester' });
    const other = await provider.lookupPayee({
      network: 'MTN',
      identifierType: 'PHONE',
      identifier: '+250788000222',
    });
    expect(other).toMatchObject({ status: 'FOUND' });
    expect(other).not.toEqual({ status: 'FOUND', registeredName: 'Jane Tester' });
  });

  it('rejects malformed HYBRID_TEST_PAYEES entries', () => {
    expect(parseHybridTestPayees('')).toEqual(new Map());
    expect(() => parseHybridTestPayees('12345=Jane')).toThrow(/HYBRID_TEST_PAYEES/);
  });
});
