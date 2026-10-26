import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Application-level AES-256-GCM for individual sensitive columns (partner card tokens, admin TOTP
 * secrets), on top of database/disk encryption. The context string is bound as additional
 * authenticated data, so a ciphertext copied into another column fails to decrypt.
 *
 * Format: v1.<keyId>.<iv>.<ciphertext>.<tag> (base64url parts). The key ID allows rotation:
 * decrypt with the key named in the value, re-encrypt with the current key.
 */
export class FieldEncryption {
  constructor(
    private readonly keys: ReadonlyMap<string, Buffer>,
    private readonly currentKeyId: string,
  ) {
    const current = keys.get(currentKeyId);
    if (!current || current.length !== 32) {
      throw new Error('Current field-encryption key must be 32 bytes');
    }
  }

  static single(keyId: string, key: Buffer): FieldEncryption {
    return new FieldEncryption(new Map([[keyId, key]]), keyId);
  }

  encrypt(plaintext: string, context: string): string {
    const key = this.keys.get(this.currentKeyId) as Buffer;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      'v1',
      this.currentKeyId,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join('.');
  }

  decrypt(value: string, context: string): string {
    const [version, keyId, iv, ciphertext, tag] = value.split('.');
    if (version !== 'v1' || !keyId || !iv || ciphertext === undefined || !tag) {
      throw new Error('Unrecognised encrypted value');
    }
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Unknown field-encryption key: ${keyId}`);
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
