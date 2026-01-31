import { Module } from '@nestjs/common';
import { PostgresModule } from '../database/postgres/postgres.module';
import { AuditComplianceService } from './audit-compliance.service';
import { AuditCleanupScheduler } from './audit-cleanup.scheduler';

@Module({
  imports: [PostgresModule],
  providers: [AuditComplianceService, AuditCleanupScheduler],
  exports: [AuditComplianceService],
})
export class AuditComplianceModule {}
