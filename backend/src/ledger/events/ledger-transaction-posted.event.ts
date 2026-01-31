/** Event name to subscribe to for posted ledger transactions */
export const LEDGER_TRANSACTION_POSTED = 'ledger.transaction.posted';

/**
 * Domain event emitted after a ledger transaction is successfully posted.
 * Append-only ledger: no update/delete events.
 */
export class LedgerTransactionPostedEvent {
  constructor(
    public readonly organizationId: string,
    public readonly ledgerTransactionId: string,
    public readonly referenceType: string,
    public readonly referenceId: string,
    public readonly createdAt: Date,
  ) {}
}
