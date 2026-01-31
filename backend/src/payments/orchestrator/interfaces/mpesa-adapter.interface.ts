import { IWebhookAdapter } from './webhook-adapter.interface';

/**
 * M-Pesa webhook adapter. Verify signature and parse callback payload.
 */
export interface MpesaAdapter extends IWebhookAdapter {}
