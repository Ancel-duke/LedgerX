import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/postgres/prisma.service';
import { PAYMENT_COMPLETED } from '../domain-events/events';

/**
 * Fraud Detection: consumes payment events for analysis. Writes only to its own
 * event store; does not mutate core business data (Payment, Invoice, Ledger).
 */
@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(PAYMENT_COMPLETED)
  async handlePaymentCompleted(payload: {
    organizationId: string;
    paymentId: string;
    paymentIntentId: string;
    providerRef: string;
    amount: number;
    currency: string;
    invoiceId: string | null;
  }) {
    await this.recordPaymentEvent(PAYMENT_COMPLETED, payload);
  }

  private async recordPaymentEvent(
    eventType: string,
    payload: {
      organizationId: string;
      paymentId: string;
      paymentIntentId: string;
      providerRef: string;
      amount: number;
      currency: string;
      invoiceId: string | null;
    },
  ): Promise<void> {
    try {
      await this.prisma.fraudDetectionEvent.create({
        data: {
          organizationId: payload.organizationId,
          eventType,
          payload: payload as object,
        },
      });
    } catch (err) {
      this.logger.error(
        `Fraud event record failed [${eventType}]: ${(err as Error).message}`,
      );
    }
  }
}
