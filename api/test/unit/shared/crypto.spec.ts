import { randomBytes } from 'node:crypto';
import { FieldEncryption } from '../../../src/shared/crypto/field-encryption';
import { SecretHasher } from '../../../src/shared/crypto/secret-hasher';
import {
  constantTimeEqual,
  randomNumericCode,
  randomToken,
} from '../../../src/shared/crypto/tokens';
import {
  generatePublicReference,
  isPublicReference,
} from '../../../src/shared/references/public-reference';

const FAST_PARAMS = { memoryKiB: 1024, passes: 1, parallelism: 1 };

describe('SecretHasher (peppered Argon2id)', () => {
  const hasher = new SecretHasher(randomBytes(32), 'p1', FAST_PARAMS);

  it('verifies the right secret and rejects a wrong one', async () => {
    const phc = await hasher.hash('482913');
    expect(phc).toMatch(/^\$argon2id\$v=19\$m=1024,t=1,p=1,keyid=p1\$/);
    await expect(hasher.verify('482913', phc)).resolves.toBe(true);
    await expect(hasher.verify('482914', phc)).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hasher.hash('111111')).not.toBe(await hasher.hash('111111'));
  });

  it('cannot verify without the same pepper', async () => {
    const phc = await hasher.hash('482913');
    const otherPepper = new SecretHasher(randomBytes(32), 'p1', FAST_PARAMS);
    await expect(otherPepper.verify('482913', phc)).resolves.toBe(false);
  });

  it('rejects malformed hashes and flags weaker parameters for rehash', async () => {
    await expect(hasher.verify('1', 'not-a-hash')).resolves.toBe(false);
    const strong = new SecretHasher(randomBytes(32), 'p1', {
      memoryKiB: 2048,
      passes: 2,
      parallelism: 1,
    });
    expect(strong.needsRehash(await hasher.hash('1'))).toBe(true);
  });
});

describe('FieldEncryption', () => {
  const encryption = FieldEncryption.single('k1', randomBytes(32));

  it('round-trips and randomises ciphertexts', () => {
    const a = encryption.encrypt('tok_123', 'cards.provider_token');
    const b = encryption.encrypt('tok_123', 'cards.provider_token');
    expect(a).not.toBe(b);
    expect(a.startsWith('v1.k1.')).toBe(true);
    expect(encryption.decrypt(a, 'cards.provider_token')).toBe('tok_123');
  });

  it('binds ciphertext to its context and detects tampering', () => {
    const value = encryption.encrypt('tok_123', 'cards.provider_token');
    expect(() => encryption.decrypt(value, 'admin.totp')).toThrow();
    const parts = value.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => encryption.decrypt(parts.join('.'), 'cards.provider_token')).toThrow();
  });

  it('supports decryption with a previous key after rotation', () => {
    const oldKey = randomBytes(32);
    const old = FieldEncryption.single('k1', oldKey);
    const stored = old.encrypt('secret', 'ctx');
    const rotated = new FieldEncryption(
      new Map([
        ['k1', oldKey],
        ['k2', randomBytes(32)],
      ]),
      'k2',
    );
    expect(rotated.decrypt(stored, 'ctx')).toBe('secret');
    expect(rotated.encrypt('secret', 'ctx').startsWith('v1.k2.')).toBe(true);
  });
});

describe('tokens and references', () => {
  it('generates random tokens and numeric codes', () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const code = randomNumericCode(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('compares in constant time', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('generates readable, non-sequential public references', () => {
    const references = new Set(Array.from({ length: 500 }, () => generatePublicReference('XD')));
    expect(references.size).toBe(500);
    for (const reference of references) {
      expect(isPublicReference(reference, 'XD')).toBe(true);
      expect(reference).not.toMatch(/[01ILO]/);
    }
    expect(isPublicReference('XD-7F3K9Q')).toBe(true);
    expect(isPublicReference('XD-7F3K9')).toBe(false);
  });
});
