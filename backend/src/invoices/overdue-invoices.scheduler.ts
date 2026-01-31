import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InvoicesTransactionService } from './invoices-transaction.service';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';

/**
 * Cron job: mark overdue invoices. Idempotent; emits InvoiceOverdue only when state changes.
 * Schedule: hourly at minute 0 (configurable via OVERDUE_CRON env, e.g. "0 * * * *").
 */
@Injectable()
export class OverdueInvoicesScheduler {
  private readonly logger = new StructuredLoggerService(OverdueInvoicesScheduler.name);

  constructor(private readonly invoicesTransactionService: InvoicesTransactionService) {}

  @Cron(process.env.OVERDUE_CRON ?? '0 * * * *', { name: 'markOverdueInvoices' })
  async handleOverdueInvoices(): Promise<void> {
    try {
      const result = await this.invoicesTransactionService.markOverdueInvoices();
      this.logger.log('Overdue invoices job completed', {
        count: result.count,
        message: result.message,
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Overdue invoices job failed', undefined, e);
    }
  }
}
