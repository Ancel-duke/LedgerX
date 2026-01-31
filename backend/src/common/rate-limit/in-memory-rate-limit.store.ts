import { Injectable } from '@nestjs/common';
import { IRateLimitStore } from './rate-limit-store.interface';

interface Window {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limit store. Single-instance only; for shared limits use RedisRateLimitStore.
 */
@Injectable()
export class InMemoryRateLimitStore implements IRateLimitStore {
  private readonly store = new Map<string, Window>();

  async checkAndIncrement(key: string, limit: number, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    let w = this.store.get(key);
    if (!w || w.resetAt <= now) {
      w = { count: 0, resetAt: now + ttlMs };
      this.store.set(key, w);
    }
    w.count++;
    return w.count <= limit;
  }
}
