import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { PrismaService } from '../database/postgres/prisma.service';
import { PaymentIntentStatus } from '@prisma/client';

const DEFAULT_FLAG_THRESHOLD = 60;
const DEFAULT_BLOCK_THRESHOLD = 80;
const AMOUNT_WINDOW_DAYS = 30;
const FREQUENCY_WINDOW_MINUTES = 60;
const FAILED_WINDOW_HOURS = 24;
const MAX_AMOUNT_ANOMALY_SCORE = 40;
const MAX_FREQUENCY_SCORE = 30;
const MAX_FAILED_SCORE = 30;

export interface RiskFactors {
  amountAnomalyScore: number;
  frequencyScore: number;
  failedAttemptsScore: number;
}

export interface BlockPolicyResult {
  block: boolean;
  riskScore: number;
  reason?: string;
}

/**
 * Computes risk scores from stored fraud events and payment intents (read-only).
 * No writes to payments or ledger tables.
 */
@Injectable()
export class FraudRiskService {
  private readonly logger = new StructuredLoggerService(FraudRiskService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Get risk score for a payment (0–100). Returns 0 if no signal exists. Scoped by org. */
  async getRiskScore(
    organizationId: string,
    paymentId: string,
  ): Promise<{ riskScore: number; factors?: RiskFactors }> {
    const signal = await this.prisma.fraudSignal.findUnique({
      where: {
        organizationId_entityType_entityId: {
          organizationId,
          entityType: 'PAYMENT',
          entityId: paymentId,
        },
      },
    });
    if (!signal) {
      return { riskScore: 0 };
    }
    const factors = signal.factors as RiskFactors | null;
    return {
      riskScore: signal.riskScore,
      factors: factors ?? undefined,
    };
  }

  /** List flagged transactions (payments/ledger) for an org. Read-only. */
  async listFlaggedTransactions(
    organizationId: string,
    page = 1,
    limit = 20,
    entityType?: 'PAYMENT' | 'LEDGER_TRANSACTION',
  ) {
    const skip = (page - 1) * limit;
    const where = { organizationId, isFlagged: true, ...(entityType && { entityType }) };
    const [data, total] = await Promise.all([
      this.prisma.fraudSignal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.fraudSignal.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Policy-based check: whether to block FUTURE operations for this payment.
   * No auto-reversal; caller uses this to block before creating new operations.
   */
  async shouldBlockPayment(
    organizationId: string,
    paymentId: string,
  ): Promise<BlockPolicyResult> {
    const { riskScore } = await this.getRiskScore(organizationId, paymentId);
    const blockThreshold = this.getBlockThreshold();
    const block = riskScore >= blockThreshold;
    return {
      block,
      riskScore,
      reason: block ? `Risk score ${riskScore} exceeds block threshold ${blockThreshold}` : undefined,
    };
  }

  /**
   * Policy check for org-level: block if org has too many flagged transactions recently.
   * Use before allowing new payment operations.
   */
  async shouldBlockOrganization(
    organizationId: string,
    options?: { maxFlaggedInWindow?: number; windowHours?: number },
  ): Promise<BlockPolicyResult> {
    const windowHours = options?.windowHours ?? 24;
    const maxFlagged = options?.maxFlaggedInWindow ?? 5;
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
    const flaggedCount = await this.prisma.fraudSignal.count({
      where: {
        organizationId,
        isFlagged: true,
        createdAt: { gte: since },
      },
    });
    const block = flaggedCount >= maxFlagged;
    return {
      block,
      riskScore: block ? 100 : 0,
      reason: block
        ? `Organization has ${flaggedCount} flagged transactions in last ${windowHours}h (max ${maxFlagged})`
        : undefined,
    };
  }

  /** Compute risk score for a payment event using amount anomaly, frequency, failed attempts. */
  async computePaymentRisk(
    organizationId: string,
    paymentId: string,
    amount: number,
  ): Promise<{ riskScore: number; factors: RiskFactors; isFlagged: boolean }> {
    const [amountScore, frequencyScore, failedScore] = await Promise.all([
      this.computeAmountAnomalyScore(organizationId, amount),
      this.computeFrequencyScore(organizationId),
      this.computeFailedAttemptsScore(organizationId),
    ]);
    const factors: RiskFactors = {
      amountAnomalyScore: amountScore,
      frequencyScore,
      failedAttemptsScore: failedScore,
    };
    const riskScore = Math.min(100, Math.round(amountScore + frequencyScore + failedScore));
    const flagThreshold = this.getFlagThreshold();
    const isFlagged = riskScore >= flagThreshold;
    return { riskScore, factors, isFlagged };
  }

  /** Compute risk for a ledger transaction (frequency-based). */
  async computeLedgerRisk(
    organizationId: string,
    ledgerTransactionId: string,
  ): Promise<{ riskScore: number; factors: RiskFactors; isFlagged: boolean }> {
    const frequencyScore = await this.computeFrequencyScore(organizationId);
    const failedScore = await this.computeFailedAttemptsScore(organizationId);
    const factors: RiskFactors = {
      amountAnomalyScore: 0,
      frequencyScore,
      failedAttemptsScore: failedScore,
    };
    const riskScore = Math.min(100, Math.round(frequencyScore + failedScore));
    const flagThreshold = this.getFlagThreshold();
    const isFlagged = riskScore >= flagThreshold;
    return { riskScore, factors, isFlagged };
  }

  private async computeAmountAnomalyScore(organizationId: string, currentAmount: number): Promise<number> {
    const since = new Date(Date.now() - AMOUNT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const events = await this.prisma.fraudDetectionEvent.findMany({
      where: {
        organizationId,
        eventType: 'domain.payment.completed',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const amounts = events
      .map((e) => {
        const p = e.payload as { amount?: number };
        return typeof p?.amount === 'number' ? p.amount : 0;
      })
      .filter((a) => a > 0);
    if (amounts.length === 0) return 0;
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    if (avg <= 0) return 0;
    const ratio = currentAmount / avg;
    if (ratio <= 1) return 0;
    if (ratio >= 3) return MAX_AMOUNT_ANOMALY_SCORE;
    return Math.round(((ratio - 1) / 2) * MAX_AMOUNT_ANOMALY_SCORE);
  }

  private async computeFrequencyScore(organizationId: string): Promise<number> {
    const since = new Date(Date.now() - FREQUENCY_WINDOW_MINUTES * 60 * 1000);
    const count = await this.prisma.fraudDetectionEvent.count({
      where: {
        organizationId,
        createdAt: { gte: since },
      },
    });
    if (count <= 5) return 0;
    if (count >= 20) return MAX_FREQUENCY_SCORE;
    return Math.round(((count - 5) / 15) * MAX_FREQUENCY_SCORE);
  }

  private async computeFailedAttemptsScore(organizationId: string): Promise<number> {
    const since = new Date(Date.now() - FAILED_WINDOW_HOURS * 60 * 60 * 1000);
    const count = await this.prisma.paymentIntent.count({
      where: {
        organizationId,
        status: PaymentIntentStatus.FAILED,
        updatedAt: { gte: since },
      },
    });
    if (count === 0) return 0;
    if (count >= 5) return MAX_FAILED_SCORE;
    return Math.round((count / 5) * MAX_FAILED_SCORE);
  }

  private getFlagThreshold(): number {
    const env = process.env.FRAUD_RISK_FLAG_THRESHOLD;
    return env ? parseInt(env, 10) : DEFAULT_FLAG_THRESHOLD;
  }

  private getBlockThreshold(): number {
    const env = process.env.FRAUD_RISK_BLOCK_THRESHOLD;
    return env ? parseInt(env, 10) : DEFAULT_BLOCK_THRESHOLD;
  }
}
