/** Event name: published after a payment is successfully completed (e.g. via orchestrator). */
export const PAYMENT_COMPLETED = 'domain.payment.completed';

export interface PaymentCompletedPayload {
  organizationId: string;
  paymentId: string;
  paymentIntentId: string;
  providerRef: string;
  amount: number;
  currency: string;
  invoiceId: string | null;
}
