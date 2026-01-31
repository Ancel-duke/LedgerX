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
import { StripeProviderClient } from './orchestrator/clients/stripe-provider.client';
import { MpesaProviderClient } from './orchestrator/clients/mpesa-provider.client';

@Module({
  controllers: [PaymentsController, WebhooksController],
  providers: [
    PaymentsService,
    PaymentOrchestratorService,
    MpesaAdapter,
    StripeAdapter,
    StripeProviderClient,
    MpesaProviderClient,
  ],
  imports: [ActivityLogModule, InvoicesModule, LedgerModule],
  exports: [StripeProviderClient, MpesaProviderClient],
})
export class PaymentsModule {}
