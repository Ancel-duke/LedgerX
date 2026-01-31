import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/postgres/prisma.service';
import { createHash } from 'crypto';
import { PAYMENT_COMPLETED, LEDGER_TRANSACTION_POSTED } from '../../domain-events/events';

const ACTOR_PAYMENT = 'payment-orchestrator';
const ACTOR_LEDGER = 'ledger-service';
const ENTITY_PAYMENT = 'PAYMENT';
const ENTITY_LEDGER_TRANSACTION = 'LEDGER_TRANSACTION';

/**
 * Audit & Compliance: consumes domain events and writes append-only records
 * with payload hash and optional hash chaining per entity timeline.
 * Does not mutate core business data; does not replace existing activity log usage.
 */
@Injectable()
export class AuditComplianceRecordService {
  private readonly logger = new Logger(AuditComplianceRecordService.name);

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
    await this.record({
      organizationId: payload.organizationId,
      eventType: PAYMENT_COMPLETED,
      actor: ACTOR_PAYMENT,
      entityType: ENTITY_PAYMENT,
      entityId: payload.paymentId,
      payload,
    });
  }

  @OnEvent(LEDGER_TRANSACTION_POSTED)
  async handleLedgerTransactionPosted(payload: {
    organizationId: string;
    ledgerTransactionId: string;
    referenceType: string;
    referenceId: string;
    createdAt: Date;
  }) {
    await this.record({
      organizationId: payload.organizationId,
      eventType: LEDGER_TRANSACTION_POSTED,
      actor: ACTOR_LEDGER,
      entityType: ENTITY_LEDGER_TRANSACTION,
      entityId: payload.ledgerTransactionId,
      payload,
    });
  }

  private async record(params: {
    organizationId: string;
    eventType: string;
    actor: string;
    entityType: string;
    entityId: string;
    payload: object;
  }): Promise<void> {
    try {
      const payloadHash = this.hashPayload(params.payload);
      const occurredAt = new Date();

      const last = await this.prisma.auditComplianceRecord.findFirst({
        where: {
          organizationId: params.organizationId,
          entityType: params.entityType,
          entityId: params.entityId,
        },
        orderBy: { occurredAt: 'desc' },
        select: { currentHash: true },
      });
      const previousHash = last?.currentHash ?? null;
      const currentHash = this.chainHash(previousHash, payloadHash, occurredAt);

      await this.prisma.auditComplianceRecord.create({
        data: {
          organizationId: params.organizationId,
          eventType: params.eventType,
          actor: params.actor,
          entityType: params.entityType,
          entityId: params.entityId,
          payloadHash,
          previousHash,
          currentHash,
          occurredAt,
        },
      });
    } catch (err) {
      this.logger.error(
        `Audit compliance record failed [${params.eventType}]: ${(err as Error).message}`,
      );
    }
  }

  private hashPayload(payload: object): string {
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    return createHash('sha256').update(json).digest('hex');
  }

  private chainHash(previousHash: string | null, payloadHash: string, occurredAt: Date): string {
    const input = [previousHash ?? '', payloadHash, occurredAt.toISOString()].join('|');
    return createHash('sha256').update(input).digest('hex');
  }

  /** Read-only: entity audit history (append-only; no update/delete). */
  async getEntityAuditHistory(
    organizationId: string,
    entityType: string,
    entityId: string,
    page = 1,
    limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditComplianceRecord.findMany({
        where: { organizationId, entityType, entityId },
        orderBy: { occurredAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.auditComplianceRecord.count({
        where: { organizationId, entityType, entityId },
      }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Read-only: time-range export (append-only; no update/delete). */
  async getTimeRangeExport(
    organizationId: string,
    from: Date,
    to: Date,
    page = 1,
    limit = 100,
  ) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditComplianceRecord.findMany({
        where: {
          organizationId,
          occurredAt: { gte: from, lte: to },
        },
        orderBy: { occurredAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.auditComplianceRecord.count({
        where: {
          organizationId,
          occurredAt: { gte: from, lte: to },
        },
      }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
