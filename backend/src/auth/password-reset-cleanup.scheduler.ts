import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/postgres/prisma.service';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { ScheduledJobsRegistryService } from '../common/scheduled-jobs/scheduled-jobs-registry.service';

const JOB_NAME = 'passwordResetTokenCleanup';

/**
 * Scheduled cleanup of expired password reset tokens. Idempotent; runs on schedule.
 */
@Injectable()
export class PasswordResetCleanupScheduler {
  private readonly logger = new StructuredLoggerService(PasswordResetCleanupScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsRegistry: ScheduledJobsRegistryService,
  ) {
    this.jobsRegistry.register(JOB_NAME, process.env.PASSWORD_RESET_CLEANUP_CRON ?? '0 3 * * *');
  }

  @Cron(process.env.PASSWORD_RESET_CLEANUP_CRON ?? '0 3 * * *', { name: JOB_NAME })
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const result = await this.prisma.passwordResetToken.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        this.logger.log('Expired password reset tokens cleaned', { count: result.count });
      }
      this.jobsRegistry.recordRun(JOB_NAME, 'ok');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Password reset token cleanup failed', undefined, e);
      this.jobsRegistry.recordRun(JOB_NAME, 'error');
    }
  }
}
