/** Event name to subscribe to for completed provider payments */
export const PAYMENT_COMPLETED = 'payment.orchestrator.completed';

/**
 * Domain event emitted when an external provider payment is successfully
 * processed by the orchestrator (existing Payments flow + ledger).
 */
export class PaymentCompletedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly paymentId: string,
    public readonly paymentIntentId: string,
    public readonly providerRef: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly invoiceId: string | null,
  ) {}
}
