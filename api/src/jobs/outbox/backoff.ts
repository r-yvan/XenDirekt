/**
 * Exponential backoff with full jitter: a random delay in [0, min(cap, base × 2^(attempt-1))].
 * Jitter spreads retries so a provider recovering from an outage is not hit by a thundering herd.
 */
export function backoffDelayMs(
  attempt: number,
  baseMs = 2_000,
  capMs = 300_000,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, attempt - 1);
  const ceiling = Math.min(capMs, baseMs * 2 ** Math.min(exponent, 30));
  return Math.floor(random() * ceiling);
}
