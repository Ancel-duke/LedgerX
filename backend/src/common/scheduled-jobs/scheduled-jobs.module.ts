import { Global, Module } from '@nestjs/common';
import { ScheduledJobsRegistryService } from './scheduled-jobs-registry.service';

@Global()
@Module({
  providers: [ScheduledJobsRegistryService],
  exports: [ScheduledJobsRegistryService],
})
export class ScheduledJobsModule {}
