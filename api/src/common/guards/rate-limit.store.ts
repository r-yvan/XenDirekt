import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface RateLimitHit {
  count: number;
  /** Milliseconds until the window resets. */
  resetMs: number;
}

/** Fixed-window counters. Redis in shared environments, memory for tests and local runs. */
export abstract class RateLimitStore {
  abstract hit(key: string, windowMs: number): Promise<RateLimitHit>;
  abstract ping(): Promise<boolean>;
  abstract close(): Promise<void>;
}

export class InMemoryRateLimitStore extends RateLimitStore {
  private readonly windows = new Map<string, { count: number; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {
    super();
  }

  hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const now = this.now();
    const current = this.windows.get(key);
    if (!current || current.expiresAt <= now) {
      this.windows.set(key, { count: 1, expiresAt: now + windowMs });
      if (this.windows.size > 50_000) {
        this.evictExpired(now);
      }
      return Promise.resolve({ count: 1, resetMs: windowMs });
    }
    current.count += 1;
    return Promise.resolve({ count: current.count, resetMs: current.expiresAt - now });
  }

  ping(): Promise<boolean> {
    return Promise.resolve(true);
  }

  close(): Promise<void> {
    this.windows.clear();
    return Promise.resolve();
  }

  private evictExpired(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}

/** Atomic INCR + PEXPIRE (on first hit) in one round trip. */
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export class RedisRateLimitStore extends RateLimitStore {
  private readonly logger = new Logger(RedisRateLimitStore.name);
  private readonly client: Redis;

  constructor(url: string) {
    super();
    this.client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    this.client.on('error', (error: Error) =>
      this.logger.warn({ err: error }, 'Redis connection error'),
    );
  }

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const result = (await this.client.eval(HIT_SCRIPT, 1, `rl:${key}`, String(windowMs))) as [
      number,
      number,
    ];
    return { count: Number(result[0]), resetMs: Math.max(0, Number(result[1])) };
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
