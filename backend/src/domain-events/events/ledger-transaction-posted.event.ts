/** Event name: published after a ledger transaction is successfully posted. */
export const LEDGER_TRANSACTION_POSTED = 'domain.ledger.transaction.posted';

export interface LedgerTransactionPostedPayload {
  organizationId: string;
  ledgerTransactionId: string;
  referenceType: string;
  referenceId: string;
  createdAt: Date;
}
