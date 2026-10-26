import { SetMetadata } from '@nestjs/common';

/**
 * Which request attribute a limit counts against:
 * - ip: client IP (honours TRUST_PROXY)
 * - user / admin: authenticated principal, falls back to IP
 * - device: X-Device-Id header, falls back to IP
 * - body:<field>: SHA-256 of a body field (e.g. the OTP destination), so no raw personal data
 *   ends up in Redis keys
 */
export type RateLimitKey = 'ip' | 'user' | 'admin' | 'device' | `body:${string}`;

export interface RateLimitRule {
  /** Stable name; part of the counter key. */
  name: string;
  key: RateLimitKey;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMIT_RULES = 'xd:rateLimitRules';

export const RateLimit = (...rules: RateLimitRule[]): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_RULES, rules);
