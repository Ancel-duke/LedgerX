import { Module } from '@nestjs/common';
import { PostgresModule } from '../database/postgres/postgres.module';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudRiskService } from './fraud-risk.service';
import { FraudDetectionController } from './fraud-detection.controller';

@Module({
  imports: [PostgresModule],
  controllers: [FraudDetectionController],
  providers: [FraudDetectionService, FraudRiskService],
  exports: [FraudDetectionService, FraudRiskService],
})
export class FraudDetectionModule {}
