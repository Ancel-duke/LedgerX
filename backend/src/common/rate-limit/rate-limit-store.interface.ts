/**
 * Shared rate limit store: in-memory (single instance) or Redis (shared across instances).
 * Used by SensitiveEndpointsRateLimitGuard for IP and org-scoped limits.
 */
export interface IRateLimitStore {
  /**
   * Check and increment counter for key. Returns false if limit exceeded (caller should reject with 429).
   * Window resets at resetAt (fixed window: first request in window sets resetAt = now + ttlMs).
   */
  checkAndIncrement(key: string, limit: number, ttlMs: number): Promise<boolean>;
}
