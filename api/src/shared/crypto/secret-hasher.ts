import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const argon2Async = promisify(argon2);

/** OWASP minimum for Argon2id: 19 MiB memory, 2 passes, 1 lane (~50 ms on a laptop core). */
export const DEFAULT_ARGON2_PARAMS = { memoryKiB: 19_456, passes: 2, parallelism: 1 } as const;
const TAG_LENGTH = 32;
const SALT_LENGTH = 16;

export interface Argon2Params {
  memoryKiB: number;
  passes: number;
  parallelism: number;
}

/**
 * Argon2id with a server-side pepper supplied as Argon2's native `secret` input. The pepper is
 * never stored with the hash, so a database copy alone does not allow offline guessing, which
 * matters for 6-digit PINs. Output is a PHC string:
 *   $argon2id$v=19$m=19456,t=2,p=1,keyid=<pepperId>$<salt>$<hash>
 */
export class SecretHasher {
  constructor(
    private readonly pepper: Buffer,
    private readonly pepperId: string,
    private readonly params: Argon2Params = DEFAULT_ARGON2_PARAMS,
  ) {}

  async hash(secret: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const tag = await this.derive(secret, salt, this.params);
    const { memoryKiB, passes, parallelism } = this.params;
    return `$argon2id$v=19$m=${memoryKiB},t=${passes},p=${parallelism},keyid=${this.pepperId}$${salt.toString('base64url')}$${tag.toString('base64url')}`;
  }

  async verify(secret: string, phc: string): Promise<boolean> {
    const parsed = parsePhc(phc);
    if (!parsed || parsed.keyId !== this.pepperId) {
      return false;
    }
    const expected = Buffer.from(parsed.hash, 'base64url');
    const actual = await this.derive(secret, Buffer.from(parsed.salt, 'base64url'), parsed.params);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  /** True when the stored hash uses weaker parameters than the current policy. */
  needsRehash(phc: string): boolean {
    const parsed = parsePhc(phc);
    if (!parsed) {
      return true;
    }
    return (
      parsed.keyId !== this.pepperId ||
      parsed.params.memoryKiB < this.params.memoryKiB ||
      parsed.params.passes < this.params.passes
    );
  }

  private async derive(secret: string, salt: Buffer, params: Argon2Params): Promise<Buffer> {
    return argon2Async('argon2id', {
      message: Buffer.from(secret, 'utf8'),
      nonce: salt,
      secret: this.pepper,
      parallelism: params.parallelism,
      tagLength: TAG_LENGTH,
      memory: params.memoryKiB,
      passes: params.passes,
    });
  }
}

function parsePhc(
  phc: string,
): { params: Argon2Params; keyId: string; salt: string; hash: string } | null {
  const match =
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+),keyid=([A-Za-z0-9-]+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(
      phc,
    );
  if (!match) {
    return null;
  }
  const [, memory, passes, parallelism, keyId, salt, hash] = match;
  return {
    params: { memoryKiB: Number(memory), passes: Number(passes), parallelism: Number(parallelism) },
    keyId: keyId as string,
    salt: salt as string,
    hash: hash as string,
  };
}
