import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesTransactionService } from './invoices-transaction.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesTransactionService],
  exports: [InvoicesTransactionService],
  imports: [ActivityLogModule],
})
export class InvoicesModule {}
