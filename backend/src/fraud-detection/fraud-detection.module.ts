import { Module } from '@nestjs/common';
import { PostgresModule } from '../database/postgres/postgres.module';
import { FraudDetectionService } from './fraud-detection.service';

@Module({
  imports: [PostgresModule],
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
