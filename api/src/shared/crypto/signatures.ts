import { createPublicKey, KeyObject, verify } from 'node:crypto';

export type DeviceKeyAlgorithm = 'ED25519' | 'ES256';

// DER prefix that wraps a raw 32-byte Ed25519 public key into SubjectPublicKeyInfo.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Parses a device public key: Ed25519 as raw 32 bytes (base64), ES256 as SPKI DER (base64).
 * Throws on anything else, so malformed keys are rejected at registration.
 */
export function parseDevicePublicKey(algorithm: DeviceKeyAlgorithm, base64: string): KeyObject {
  const bytes = Buffer.from(base64, 'base64');
  if (algorithm === 'ED25519') {
    if (bytes.length !== 32) {
      throw new Error('Ed25519 public key must be 32 bytes');
    }
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, bytes]),
      format: 'der',
      type: 'spki',
    });
  }
  const key = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('ES256 key must be a P-256 SPKI public key');
  }
  return key;
}

/** Ed25519 signature (64 bytes) or ES256 signature in IEEE P1363 form (r||s, 64 bytes), base64. */
export function verifyDeviceSignature(
  algorithm: DeviceKeyAlgorithm,
  publicKeyBase64: string,
  message: string,
  signatureBase64: string,
): boolean {
  try {
    const key = parseDevicePublicKey(algorithm, publicKeyBase64);
    const signature = Buffer.from(signatureBase64, 'base64');
    const data = Buffer.from(message, 'utf8');
    if (algorithm === 'ED25519') {
      return verify(null, data, key, signature);
    }
    return verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature);
  } catch {
    return false;
  }
}

/** The exact bytes the app signs for a step-up; documented in docs/api.md. */
export function stepUpSigningMessage(challengeId: string, nonce: string, purpose: string): string {
  return `xendirekt-step-up:v1:${challengeId}:${nonce}:${purpose}`;
}
