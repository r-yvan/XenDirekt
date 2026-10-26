import { randomInt } from 'node:crypto';

/**
 * Human-readable public references such as XD-7F3K9Q (PRD FR-RCP-01). Random, non-sequential,
 * and free of look-alike characters (0/O, 1/I/L) so they survive being read aloud to support.
 * Uniqueness is guaranteed by a database constraint; callers retry on collision.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 6;

export type ReferencePrefix = 'XD' | 'TK' | 'RF';

export function generatePublicReference(prefix: ReferencePrefix): string {
  let body = '';
  for (let index = 0; index < LENGTH; index += 1) {
    body += ALPHABET.charAt(randomInt(ALPHABET.length));
  }
  return `${prefix}-${body}`;
}

export function isPublicReference(value: string, prefix?: ReferencePrefix): boolean {
  const pattern = new RegExp(`^(${prefix ?? 'XD|TK|RF'})-[${ALPHABET}]{${LENGTH}}$`);
  return pattern.test(value);
}
