import { PaymentMethod } from '@prisma/client';

/**
 * Normalized payload after adapter verification and parsing.
 * organizationId is required to route the payment; providerRef enables idempotency.
 */
export interface ParsedWebhookPayload {
  organizationId: string;
  providerRef: string;
  amount: number;
  currency: string;
  invoiceId?: string;
  method: PaymentMethod;
  /** Unix timestamp (seconds) for tolerance check; optional if provider doesn't send */
  timestamp?: number;
  metadata?: Record<string, unknown>;
}
