import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  imports: [ActivityLogModule, InvoicesModule],
})
export class PaymentsModule {}
