import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/postgres/prisma.service';
import {
  PAYMENT_COMPLETED,
  LEDGER_TRANSACTION_POSTED,
  INVOICE_OVERDUE,
} from '../domain-events/events';

/**
 * Audit & Compliance: consumes domain events and writes to audit store only.
 * Does not mutate core business data (Payment, Invoice, Ledger).
 */
@Injectable()
export class AuditComplianceService {
  private readonly logger = new Logger(AuditComplianceService.name);

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
    await this.record(PAYMENT_COMPLETED, payload.organizationId, payload);
  }

  @OnEvent(LEDGER_TRANSACTION_POSTED)
  async handleLedgerTransactionPosted(payload: {
    organizationId: string;
    ledgerTransactionId: string;
    referenceType: string;
    referenceId: string;
    createdAt: Date;
  }) {
    await this.record(LEDGER_TRANSACTION_POSTED, payload.organizationId, payload);
  }

  @OnEvent(INVOICE_OVERDUE)
  async handleInvoiceOverdue(payload: {
    organizationId: string | null;
    invoiceIds: string[];
    count: number;
    occurredAt: Date;
  }) {
    const organizationId = payload.organizationId ?? 'unknown';
    await this.record(INVOICE_OVERDUE, organizationId, payload);
  }

  private async record(
    eventType: string,
    organizationId: string,
    payload: object,
  ): Promise<void> {
    try {
      await this.prisma.domainEventAudit.create({
        data: {
          organizationId,
          eventType,
          payload: payload as object,
        },
      });
    } catch (err) {
      this.logger.error(
        `Audit record failed [${eventType}]: ${(err as Error).message}`,
      );
    }
  }
}
