import { IWebhookAdapter } from './webhook-adapter.interface';

/**
 * Stripe webhook adapter. Verify Stripe-Signature and parse event payload.
 */
export interface StripeAdapter extends IWebhookAdapter {}
