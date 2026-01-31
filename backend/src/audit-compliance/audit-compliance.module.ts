import { Module } from '@nestjs/common';
import { PostgresModule } from '../database/postgres/postgres.module';
import { AuditComplianceService } from './audit-compliance.service';

@Module({
  imports: [PostgresModule],
  providers: [AuditComplianceService],
  exports: [AuditComplianceService],
})
export class AuditComplianceModule {}
