import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { LedgerModule } from '../ledger/ledger.module';
import { PaymentOrchestratorService } from './orchestrator/payment-orchestrator.service';
import { WebhooksController } from './orchestrator/webhooks.controller';
import { MpesaAdapter } from './orchestrator/adapters/mpesa.adapter';
import { StripeAdapter } from './orchestrator/adapters/stripe.adapter';

@Module({
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService, PaymentOrchestratorService, MpesaAdapter, StripeAdapter],
  imports: [ActivityLogModule, InvoicesModule, LedgerModule],
})
export class PaymentsModule {}
