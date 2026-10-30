import { randomBytes } from 'node:crypto';
import { loadLocalEnvFile } from '../../../../config/load-env-file';
import { ProviderError, ProviderRejectedError } from '../../domain/provider-errors';
import { XentriPayHttpClient } from '../xentripay-http.client';
import { XentriPayPaymentProvider } from '../xentripay-payment.provider';

/**
 * Exercises the real XentriPay adapter against XentriPay's TEST environment, so the payout leg
 * can be verified with real credentials before any money moves (docs/xentripay-sandbox.md).
 *
 *   npm run xentripay:sandbox -- check
 *   npm run xentripay:sandbox -- payout --msisdn 0788123456 --amount 100 --name "Test Seller"
 *   npm run xentripay:sandbox -- status --ref XD-SBX-...
 *
 * Reads XENTRIPAY_BASE_URL and XENTRIPAY_API_KEY from the environment or api/.env. Refuses any
 * base URL other than the test environment unless --allow-live is passed.
 */
const TEST_BASE_URL = 'https://merchant.test.xentripay.com';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  const command = process.argv[2];
  const baseUrl = (process.env.XENTRIPAY_BASE_URL ?? TEST_BASE_URL).replace(/\/+$/, '');
  const apiKey = process.env.XENTRIPAY_API_KEY;
  if (!apiKey) {
    fail('XENTRIPAY_API_KEY is not set (put it in api/.env, never in the repository).');
  }
  if (baseUrl !== TEST_BASE_URL && !process.argv.includes('--allow-live')) {
    fail(`Refusing ${baseUrl}: this tool targets ${TEST_BASE_URL}. Pass --allow-live to override.`);
  }
  const provider = new XentriPayPaymentProvider(
    new XentriPayHttpClient({ baseUrl, apiKey, responseTimeoutMs: 15_000 }),
  );
  console.log(`XentriPay at ${baseUrl}`);

  try {
    switch (command) {
      case 'check': {
        // Read-only: status of a reference that cannot exist proves auth and reachability.
        const ref = `XD-SBX-CHECK-${randomBytes(4).toString('hex')}`;
        const result = await provider.getPayoutStatus(ref);
        console.log(`✓ Authenticated and reachable. Unknown reference returned: ${result.status}`);
        return;
      }
      case 'payout': {
        const msisdn = arg('msisdn');
        const amount = Number(arg('amount') ?? '100');
        const name = arg('name') ?? 'XenDirekt Sandbox Test';
        if (!msisdn || !/^07[2389]\d{7}$/.test(msisdn)) {
          fail('--msisdn must be a local Rwandan number, e.g. 0788123456.');
        }
        if (!Number.isInteger(amount) || amount < 100 || amount > 5000) {
          fail('--amount must be a whole number of RWF between 100 and 5000 for tests.');
        }
        const ref = `XD-SBX-${Date.now().toString(36).toUpperCase()}`;
        console.log(`Sending payout ${ref}: RWF ${amount} to ${msisdn}…`);
        const initiated = await provider.payout({
          requestRef: ref,
          payee: { network: 'MTN', identifierType: 'PHONE', identifier: `+250${msisdn.slice(1)}` },
          localMsisdn: msisdn,
          recipientName: name,
          amountRwf: BigInt(amount),
        });
        console.log(`  initiation → ${initiated.status}`);
        console.log(
          '  If XentriPay requires OTP approval for payouts, approve it in their dashboard now (XP §5.1).',
        );
        await follow(provider, ref);
        return;
      }
      case 'status': {
        const ref = arg('ref') ?? fail('--ref is required');
        await follow(provider, ref, 1);
        return;
      }
      default:
        fail(
          'Usage: xentripay:sandbox -- check | payout --msisdn 07XXXXXXXX [--amount 100] [--name ""] | status --ref XD-SBX-…',
        );
    }
  } catch (error) {
    if (error instanceof ProviderRejectedError) {
      fail(
        `Rejected by XentriPay (${error.providerCode ?? 'no code'}): ${error.message}. Check the API key.`,
      );
    }
    if (error instanceof ProviderError) {
      fail(`${error.name}: ${error.message}`);
    }
    throw error;
  }
}

/** Polls payout status every 5 s until it is final or `rounds` checks have passed. */
async function follow(provider: XentriPayPaymentProvider, ref: string, rounds = 24): Promise<void> {
  for (let round = 1; round <= rounds; round++) {
    const result = await provider.getPayoutStatus(ref);
    const raw = 'raw' in result ? ` (XentriPay: ${result.raw})` : '';
    console.log(`  status check ${round} → ${result.status}${raw}`);
    if (['SUCCEEDED', 'FAILED', 'REVERSED'].includes(result.status)) {
      console.log(
        result.status === 'SUCCEEDED' ? '✓ Payout completed.' : `✗ Payout ${result.status}.`,
      );
      return;
    }
    if (round < rounds) {
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  console.log(
    '… still not final. Re-check later with: npm run xentripay:sandbox -- status --ref ' + ref,
  );
}

void main();
