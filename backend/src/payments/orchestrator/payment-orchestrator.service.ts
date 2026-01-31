import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { Prisma } from '@prisma/client';
import { PaymentProvider, PaymentIntentStatus } from '@prisma/client';
import { PaymentMethod } from '@prisma/client';
import { PaymentsService } from '../payments.service';
import { LedgerService } from '../../ledger/ledger.service';
import { DomainEventBus } from '../../domain-events/domain-event-bus.service';
import { PAYMENT_COMPLETED } from '../../domain-events/events';
import { IWebhookAdapter } from './interfaces/webhook-adapter.interface';
import { ParsedWebhookPayload } from './types/parsed-webhook-payload';
import { LedgerEntryDirection } from '@prisma/client';
import { MpesaAdapter } from './adapters/mpesa.adapter';
import { StripeAdapter } from './adapters/stripe.adapter';

const SYSTEM_USER_ID = 'system';

export interface HandleWebhookResult {
  paymentIntentId: string;
  paymentId: string;
  invoiceId: string | null;
  idempotent: boolean;
}

/**
 * Payment Orchestrator: receives provider webhooks, verifies and parses via adapters,
 * enforces idempotency, then delegates to existing Payments flow. Does not duplicate
 * payment business logic; providers never write directly to the database.
 */
@Injectable()
export class PaymentOrchestratorService {
  private readonly logger = new Logger(PaymentOrchestratorService.name);
  private readonly adapters: Map<PaymentProvider, IWebhookAdapter> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly ledgerService: LedgerService,
    private readonly domainEventBus: DomainEventBus,
    mpesaAdapter: MpesaAdapter,
    stripeAdapter: StripeAdapter,
  ) {
    this.adapters.set(PaymentProvider.MPESA, mpesaAdapter);
    this.adapters.set(PaymentProvider.STRIPE, stripeAdapter);
  }

  /**
   * Handle webhook from external provider. Verifies signature, enforces timestamp
   * tolerance, enforces idempotency by providerRef + organizationId, then calls
   * existing Payments flow, emits PaymentCompleted, and posts Ledger entries.
   */
  async handleWebhook(
    provider: PaymentProvider,
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<HandleWebhookResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadRequestException(`Unknown payment provider: ${provider}`);
    }

    const signatureHeader = headers['stripe-signature'] ?? headers['Stripe-Signature'] ?? headers['x-mpesa-signature'] ?? headers['X-Mpesa-Signature'];

    if (!adapter.verifySignature(rawBody, signatureHeader, headers)) {
      throw new UnauthorizedException('Webhook signature verification failed');
    }

    let payload: ParsedWebhookPayload;
    try {
      payload = adapter.parsePayload(rawBody);
    } catch (err) {
      this.logger.warn(`Webhook parse failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook payload');
    }

    const toleranceMs = adapter.getTimestampToleranceMs();
    if (payload.timestamp != null && toleranceMs > 0) {
      const ageMs = Date.now() - payload.timestamp * 1000;
      if (ageMs > toleranceMs || ageMs < -toleranceMs) {
        throw new BadRequestException('Webhook timestamp outside tolerance window');
      }
    }

    return this.processPaymentIntent(provider, payload);
  }

  /**
   * Idempotent processing: one PaymentIntent per (organizationId, provider, providerRef).
   * On success: existing Payments flow, PaymentCompleted event, Ledger entries.
   */
  private async processPaymentIntent(
    provider: PaymentProvider,
    payload: ParsedWebhookPayload,
  ): Promise<HandleWebhookResult> {
    const { organizationId, providerRef, amount, currency, invoiceId, method } = payload;

    const existing = await this.prisma.paymentIntent.findUnique({
      where: {
        organizationId_provider_providerRef: {
          organizationId,
          provider,
          providerRef,
        },
      },
    });

    if (existing) {
      if (existing.status === PaymentIntentStatus.COMPLETED && existing.paymentId) {
        this.logger.log(`Idempotent webhook: ${provider}:${providerRef}`);
        return {
          paymentIntentId: existing.id,
          paymentId: existing.paymentId,
          invoiceId: existing.invoiceId,
          idempotent: true,
        };
      }
      if (existing.status === PaymentIntentStatus.PENDING) {
        throw new BadRequestException('Payment already in progress');
      }
      if (existing.status === PaymentIntentStatus.FAILED) {
        throw new BadRequestException('Payment intent previously failed');
      }
    }

    const intent = await this.prisma.paymentIntent.upsert({
      where: {
        organizationId_provider_providerRef: {
          organizationId,
          provider,
          providerRef,
        },
      },
      create: {
        organizationId,
        provider,
        providerRef,
        amount: new Prisma.Decimal(amount),
        currency: currency || 'USD',
        status: PaymentIntentStatus.PENDING,
        invoiceId: invoiceId ?? null,
        metadata: payload.metadata ? (payload.metadata as object) : undefined,
      },
      update: {},
    });

    if (intent.status === PaymentIntentStatus.COMPLETED && intent.paymentId) {
      return {
        paymentIntentId: intent.id,
        paymentId: intent.paymentId,
        invoiceId: intent.invoiceId,
        idempotent: true,
      };
    }

    let payment: { id: string };
    try {
      const created = await this.paymentsService.create(organizationId, SYSTEM_USER_ID, {
        amount,
        currency: currency || 'USD',
        method,
        status: 'COMPLETED' as const,
        transactionId: providerRef,
        invoiceId,
      });
      payment = { id: created.id };
    } catch (err) {
      await this.prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: PaymentIntentStatus.FAILED },
      });
      throw err;
    }

    await this.prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: PaymentIntentStatus.COMPLETED,
        paymentId: payment.id,
      },
    });

    this.domainEventBus.publish(PAYMENT_COMPLETED, {
      organizationId,
      paymentId: payment.id,
      paymentIntentId: intent.id,
      providerRef,
      amount,
      currency: currency || 'USD',
      invoiceId: invoiceId ?? null,
    });

    await this.postLedgerEntries(organizationId, payment.id, amount, currency);

    return {
      paymentIntentId: intent.id,
      paymentId: payment.id,
      invoiceId: invoiceId ?? null,
      idempotent: false,
    };
  }

  /**
   * Post ledger entries for payment: debit asset (bank), credit revenue.
   * Uses first ASSET and first REVENUE account for the org; skips if not configured.
   */
  private async postLedgerEntries(
    organizationId: string,
    paymentId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    try {
      const accounts = await this.ledgerService.getAccounts(organizationId);
      const assetAccount = accounts.find((a) => a.type === 'ASSET');
      const revenueAccount = accounts.find((a) => a.type === 'REVENUE');
      if (!assetAccount || !revenueAccount) {
        this.logger.warn(
          'Ledger accounts (ASSET/REVENUE) not configured; skipping ledger post',
        );
        return;
      }
      const amountCents = Math.round(amount * 100);
      if (amountCents <= 0) return;
      await this.ledgerService.postTransaction(organizationId, {
        referenceType: 'PAYMENT',
        referenceId: paymentId,
        entries: [
          { accountId: assetAccount.id, direction: LedgerEntryDirection.DEBIT, amount: amountCents },
          { accountId: revenueAccount.id, direction: LedgerEntryDirection.CREDIT, amount: amountCents },
        ],
      });
    } catch (err) {
      this.logger.error(
        `Ledger post failed for payment ${paymentId}: ${(err as Error).message}`,
      );
    }
  }
}
