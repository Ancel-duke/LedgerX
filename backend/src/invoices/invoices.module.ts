import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesTransactionService } from './invoices-transaction.service';
import { OverdueInvoicesScheduler } from './overdue-invoices.scheduler';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesTransactionService, OverdueInvoicesScheduler],
  exports: [InvoicesTransactionService],
  imports: [ActivityLogModule],
})
export class InvoicesModule {}
