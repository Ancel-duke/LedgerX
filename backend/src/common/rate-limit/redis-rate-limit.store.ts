import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { IRateLimitStore } from './rate-limit-store.interface';
import { StructuredLoggerService } from '../structured-logger/structured-logger.service';

const KEY_PREFIX = 'rl:';

/**
 * Redis-backed rate limit store. Shared across instances; use when REDIS_URL is set.
 */
@Injectable()
export class RedisRateLimitStore implements IRateLimitStore, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new StructuredLoggerService(RedisRateLimitStore.name);

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('RedisRateLimitStore requires REDIS_URL');
    }
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => (times > 2 ? null : 1000),
      lazyConnect: true,
    });
    this.redis.on('error', (err) => this.logger.warn('Redis rate limit store error', { error: err.message }));
  }

  async checkAndIncrement(key: string, limit: number, ttlMs: number): Promise<boolean> {
    const rkey = KEY_PREFIX + key;
    try {
      const n = await this.redis.incr(rkey);
      if (n === 1) {
        await this.redis.pexpire(rkey, ttlMs);
      }
      return n <= limit;
    } catch (err) {
      this.logger.warn('Redis rate limit check failed, allowing request', { error: err instanceof Error ? err.message : String(err) });
      return true; // fail open to avoid blocking all traffic
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
