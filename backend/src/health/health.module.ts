import { Module } from '@nestjs/common';
import { PostgresModule } from '../database/postgres/postgres.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [PostgresModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
