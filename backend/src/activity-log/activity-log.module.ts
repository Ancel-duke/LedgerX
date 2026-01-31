import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostgresModule } from '../database/postgres/postgres.module';
import { ActivityLogController } from './activity-log.controller';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog, ActivityLogSchema } from './schemas/activity-log.schema';
import { AuditComplianceController } from './audit/audit-compliance.controller';
import { AuditComplianceRecordService } from './audit/audit-compliance-record.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
    PostgresModule,
  ],
  controllers: [ActivityLogController, AuditComplianceController],
  providers: [ActivityLogService, AuditComplianceRecordService],
  exports: [ActivityLogService],
})
export class ActivityLogModule {}
