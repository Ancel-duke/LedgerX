import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/postgres/prisma.service';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import {
  PAYMENT_COMPLETED,
  LEDGER_TRANSACTION_POSTED,
  INVOICE_OVERDUE,
  PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_COMPLETED,
} from '../domain-events/events';

const AUTH_AUDIT_ORG_ID = 'auth';

/**
 * Audit & Compliance: consumes domain events and writes to audit store only.
 * Does not mutate core business data (Payment, Invoice, Ledger).
 */
@Injectable()
export class AuditComplianceService {
  private readonly logger = new StructuredLoggerService(AuditComplianceService.name);

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

  @OnEvent(PASSWORD_RESET_REQUESTED)
  async handlePasswordResetRequested(payload: { userId: string }) {
    await this.record(PASSWORD_RESET_REQUESTED, AUTH_AUDIT_ORG_ID, payload);
  }

  @OnEvent(PASSWORD_RESET_COMPLETED)
  async handlePasswordResetCompleted(payload: { userId: string }) {
    await this.record(PASSWORD_RESET_COMPLETED, AUTH_AUDIT_ORG_ID, payload);
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
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Audit record failed', { eventType }, e);
    }
  }
}
