import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Records real API response bodies as shared contract fixtures in /contracts/fixtures. The Flutter
 * test suite decodes the same files with the app's models, so an API shape change that the app
 * does not handle fails the mobile tests. Secrets are replaced by placeholders before writing.
 */
const FIXTURE_DIR = resolve(__dirname, '..', '..', '..', 'contracts', 'fixtures');
const SECRET_FIELDS = new Set([
  'accessToken',
  'refreshToken',
  'stepUpToken',
  'challengeToken',
  'nonce',
  'initialPassword',
  'totpSecret',
  'totpProvisioningUri',
]);

function sanitise(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitise);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_FIELDS.has(key) && typeof item === 'string' ? `<${key}>` : sanitise(item),
      ]),
    );
  }
  return value;
}

export function recordContract(name: string, body: unknown): void {
  if (process.env.RECORD_CONTRACTS === '0') {
    return;
  }
  mkdirSync(FIXTURE_DIR, { recursive: true });
  writeFileSync(
    resolve(FIXTURE_DIR, `${name}.json`),
    `${JSON.stringify(sanitise(body), null, 2)}\n`,
  );
}
