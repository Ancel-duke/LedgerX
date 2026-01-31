import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../database/postgres/prisma.service';
import { PAYMENT_COMPLETED, LEDGER_TRANSACTION_POSTED } from '../domain-events/events';
import { FraudRiskService } from './fraud-risk.service';

/**
 * Fraud Detection: consumes domain events, stores them, and computes risk signals.
 * Writes only to fraud_detection_events and fraud_signals; does not mutate payments or ledger.
 */
@Injectable()
export class FraudDetectionService {
  private readonly logger = new StructuredLoggerService(FraudDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fraudRiskService: FraudRiskService,
  ) {}

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
    try {
      const { riskScore, factors, isFlagged } =
        await this.fraudRiskService.computePaymentRisk(
          payload.organizationId,
          payload.paymentId,
          payload.amount,
        );
      await this.upsertFraudSignal(
        payload.organizationId,
        'PAYMENT',
        payload.paymentId,
        riskScore,
        factors,
        isFlagged,
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Fraud risk compute failed', { eventType: PAYMENT_COMPLETED }, e);
    }
  }

  @OnEvent(LEDGER_TRANSACTION_POSTED)
  async handleLedgerTransactionPosted(payload: {
    organizationId: string;
    ledgerTransactionId: string;
    referenceType: string;
    referenceId: string;
    createdAt: Date;
  }) {
    await this.recordLedgerEvent(LEDGER_TRANSACTION_POSTED, payload);
    try {
      const { riskScore, factors, isFlagged } =
        await this.fraudRiskService.computeLedgerRisk(
          payload.organizationId,
          payload.ledgerTransactionId,
        );
      await this.upsertFraudSignal(
        payload.organizationId,
        'LEDGER_TRANSACTION',
        payload.ledgerTransactionId,
        riskScore,
        factors,
        isFlagged,
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Fraud risk compute failed', { eventType: LEDGER_TRANSACTION_POSTED }, e);
    }
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
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Fraud event record failed', { eventType }, e);
    }
  }

  private async recordLedgerEvent(
    eventType: string,
    payload: {
      organizationId: string;
      ledgerTransactionId: string;
      referenceType: string;
      referenceId: string;
      createdAt: Date;
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
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Fraud event record failed', { eventType }, e);
    }
  }

  private async upsertFraudSignal(
    organizationId: string,
    entityType: string,
    entityId: string,
    riskScore: number,
    factors: object,
    isFlagged: boolean,
  ): Promise<void> {
    await this.prisma.fraudSignal.upsert({
      where: {
        organizationId_entityType_entityId: {
          organizationId,
          entityType,
          entityId,
        },
      },
      create: {
        organizationId,
        entityType,
        entityId,
        riskScore,
        factors: factors as object,
        isFlagged,
      },
      update: {
        riskScore,
        factors: factors as object,
        isFlagged,
      },
    });
  }
}
