import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { InMemoryRateLimitStore, RateLimitStore, RedisRateLimitStore } from './rate-limit.store';

@Global()
@Module({
  providers: [
    {
      provide: RateLimitStore,
      inject: [AppConfig],
      useFactory: (config: AppConfig): RateLimitStore => {
        if (config.redisUrl) {
          return new RedisRateLimitStore(config.redisUrl);
        }
        // Production refuses to start without REDIS_URL (startup-guards.ts).
        new Logger('RateLimitModule').warn(
          'REDIS_URL not set: rate limits are per-process (in memory)',
        );
        return new InMemoryRateLimitStore();
      },
    },
  ],
  exports: [RateLimitStore],
})
export class RateLimitModule implements OnApplicationShutdown {
  constructor(@Inject(RateLimitStore) private readonly store: RateLimitStore) {}

  async onApplicationShutdown(): Promise<void> {
    await this.store.close();
  }
}
