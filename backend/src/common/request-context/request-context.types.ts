/**
 * Per-request context stored in AsyncLocalStorage.
 * Middleware sets requestId; interceptor sets userId, orgId, paymentId when available.
 */
export interface RequestContextStore {
  requestId: string;
  userId?: string;
  orgId?: string;
  paymentId?: string;
}
