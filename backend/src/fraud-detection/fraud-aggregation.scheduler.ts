import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { ScheduledJobsRegistryService } from '../common/scheduled-jobs/scheduled-jobs-registry.service';
import { FraudRiskService } from './fraud-risk.service';
import { PrismaService } from '../database/postgres/prisma.service';

const JOB_NAME = 'fraudAggregation';

/**
 * Scheduled job: fraud aggregation — org-level risk score and flagged count.
 * Read-only from payments/ledger; persists only to FraudOrgAggregate. No blocking or reversals.
 */
@Injectable()
export class FraudAggregationScheduler {
  private readonly logger = new StructuredLoggerService(FraudAggregationScheduler.name);

  constructor(
    private readonly jobsRegistry: ScheduledJobsRegistryService,
    private readonly fraudRiskService: FraudRiskService,
    private readonly prisma: PrismaService,
  ) {
    this.jobsRegistry.register(JOB_NAME, process.env.FRAUD_AGGREGATION_CRON ?? '0 4 * * *');
  }

  @Cron(process.env.FRAUD_AGGREGATION_CRON ?? '0 4 * * *', { name: JOB_NAME })
  async run(): Promise<void> {
    try {
      const orgIds = await this.fraudRiskService.getOrganizationIdsWithSignals();
      const riskWindowDays = process.env.FRAUD_AGGREGATION_RISK_WINDOW_DAYS
        ? parseInt(process.env.FRAUD_AGGREGATION_RISK_WINDOW_DAYS, 10)
        : 30;

      for (const organizationId of orgIds) {
        const { riskScore, flaggedCount } = await this.fraudRiskService.aggregateOrgFraud(
          organizationId,
          { riskWindowDays },
        );
        await this.prisma.fraudOrgAggregate.upsert({
          where: { organizationId },
          create: {
            organizationId,
            riskScore,
            flaggedCount,
          },
          update: {
            riskScore,
            flaggedCount,
            aggregatedAt: new Date(),
          },
        });
      }

      this.logger.log('Fraud aggregation completed', {
        organizationCount: orgIds.length,
        riskWindowDays,
      });
      this.jobsRegistry.recordRun(JOB_NAME, 'ok');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Fraud aggregation job failed', undefined, e);
      this.jobsRegistry.recordRun(JOB_NAME, 'error');
    }
  }
}
