/** Event name: published after invoices are marked overdue (after successful DB transaction). */
export const INVOICE_OVERDUE = 'domain.invoice.overdue';

export interface InvoiceOverduePayload {
  organizationId: string | null;
  invoiceIds: string[];
  count: number;
  occurredAt: Date;
}
