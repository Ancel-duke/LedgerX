import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/postgres/prisma.service';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { ScheduledJobsRegistryService } from '../common/scheduled-jobs/scheduled-jobs-registry.service';

const JOB_NAME = 'auditCleanup';
const DEFAULT_RETENTION_DAYS = 365;

/**
 * Scheduled job: delete old DomainEventAudit records beyond retention.
 * Configurable via AUDIT_RETENTION_DAYS (default 365).
 */
@Injectable()
export class AuditCleanupScheduler {
  private readonly logger = new StructuredLoggerService(AuditCleanupScheduler.name);
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsRegistry: ScheduledJobsRegistryService,
  ) {
    const env = process.env.AUDIT_RETENTION_DAYS;
    this.retentionDays = env ? parseInt(env, 10) : DEFAULT_RETENTION_DAYS;
    this.jobsRegistry.register(JOB_NAME, process.env.AUDIT_CLEANUP_CRON ?? '0 5 * * 0');
  }

  @Cron(process.env.AUDIT_CLEANUP_CRON ?? '0 5 * * 0', { name: JOB_NAME })
  async run(): Promise<void> {
    if (this.retentionDays < 1) {
      this.jobsRegistry.recordRun(JOB_NAME, 'ok');
      return;
    }
    try {
      const before = new Date();
      before.setDate(before.getDate() - this.retentionDays);
      const result = await this.prisma.domainEventAudit.deleteMany({
        where: { occurredAt: { lt: before } },
      });
      if (result.count > 0) {
        this.logger.log('Audit cleanup completed', { deleted: result.count, olderThan: before.toISOString() });
      }
      this.jobsRegistry.recordRun(JOB_NAME, 'ok');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Audit cleanup job failed', undefined, e);
      this.jobsRegistry.recordRun(JOB_NAME, 'error');
    }
  }
}
