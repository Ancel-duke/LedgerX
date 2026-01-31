import { ParsedWebhookPayload } from '../types/parsed-webhook-payload';

/**
 * Adapter for external payment provider webhooks.
 * Verifies signatures and parses payload; does not write to the database.
 */
export interface IWebhookAdapter {
  /**
   * Verify webhook signature. Returns false if invalid or missing.
   */
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined, headers: Record<string, string>): boolean;

  /**
   * Parse and normalize webhook body. Throws if body is invalid.
   */
  parsePayload(rawBody: Buffer): ParsedWebhookPayload;

  /**
   * Max age of webhook in ms (timestamp tolerance). Reject if (now - timestamp) > this.
   */
  getTimestampToleranceMs(): number;
}
