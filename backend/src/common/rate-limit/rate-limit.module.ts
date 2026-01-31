import { Module } from '@nestjs/common';
import { IRateLimitStore } from './rate-limit-store.interface';
import { InMemoryRateLimitStore } from './in-memory-rate-limit.store';
import { RedisRateLimitStore } from './redis-rate-limit.store';

export const RATE_LIMIT_STORE = 'RATE_LIMIT_STORE';

@Module({
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      useFactory: (): IRateLimitStore => {
        if (process.env.REDIS_URL) {
          return new RedisRateLimitStore();
        }
        return new InMemoryRateLimitStore();
      },
    },
  ],
  exports: [RATE_LIMIT_STORE],
})
export class RateLimitModule {}
