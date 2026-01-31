import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { CurrentOrg } from '../common/decorators/current-org.decorator';
import { FraudRiskService } from './fraud-risk.service';

/**
 * Fraud Detection: read-only endpoints for risk scores and flagged transactions.
 * Policy-based blocking is via FraudRiskService.shouldBlockPayment (used by other modules).
 */
@Controller('fraud-detection')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class FraudDetectionController {
  constructor(private readonly fraudRiskService: FraudRiskService) {}

  /** Get risk score for a payment (0–100). */
  @Get('risk-score/:paymentId')
  async getRiskScore(
    @CurrentOrg() organizationId: string,
    @Param('paymentId') paymentId: string,
  ) {
    const result = await this.fraudRiskService.getRiskScore(organizationId, paymentId);
    return {
      paymentId,
      riskScore: result.riskScore,
      factors: result.factors,
    };
  }

  /** List flagged transactions (payments/ledger) for the current org. */
  @Get('flagged')
  async listFlagged(
    @CurrentOrg() organizationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entityType') entityType?: 'PAYMENT' | 'LEDGER_TRANSACTION',
  ) {
    const pageNum = page && page > 0 ? page : 1;
    const limitNum = limit && limit > 0 && limit <= 100 ? limit : 20;
    return this.fraudRiskService.listFlaggedTransactions(
      organizationId,
      pageNum,
      limitNum,
      entityType,
    );
  }

  /**
   * Policy check: whether the system would block future operations for this payment.
   * Use before creating new operations (no auto-reversal).
   */
  @Get('policy/block-check/:paymentId')
  async blockCheck(
    @CurrentOrg() organizationId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.fraudRiskService.shouldBlockPayment(organizationId, paymentId);
  }

  /** Get persisted org-level fraud aggregate (from scheduled job). */
  @Get('org-aggregate')
  async getOrgAggregate(@CurrentOrg() organizationId: string) {
    const aggregate = await this.fraudRiskService.getOrgAggregate(organizationId);
    return aggregate ?? { riskScore: 0, flaggedCount: 0, aggregatedAt: null };
  }

  /** Policy check at org level: block if too many flagged in window. */
  @Get('policy/org-block-check')
  async orgBlockCheck(
    @CurrentOrg() organizationId: string,
    @Query('windowHours') windowHours?: number,
    @Query('maxFlagged') maxFlagged?: number,
  ) {
    return this.fraudRiskService.shouldBlockOrganization(organizationId, {
      windowHours: windowHours ? Number(windowHours) : undefined,
      maxFlaggedInWindow: maxFlagged ? Number(maxFlagged) : undefined,
    });
  }
}
