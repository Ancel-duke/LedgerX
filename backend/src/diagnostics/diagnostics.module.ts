import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { RemediationService } from './remediation.service';
import { FeatureFlagsService } from './feature-flags.service';
import { MetricsModule } from '../metrics/metrics.module';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { DomainEventsModule } from '../domain-events/domain-events.module';

@Module({
  imports: [MetricsModule, CircuitBreakerModule, DomainEventsModule],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService, RemediationService, FeatureFlagsService],
  exports: [DiagnosticsService, FeatureFlagsService],
})
export class DiagnosticsModule {}
