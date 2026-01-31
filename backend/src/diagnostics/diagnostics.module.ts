import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { RemediationService } from './remediation.service';
import { RestartService } from './restart.service';
import { FeatureFlagsService } from './feature-flags.service';
import { DiagnosticsLlmService } from './diagnostics-llm.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { MetricsModule } from '../metrics/metrics.module';
import { CircuitBreakerModule } from '../common/circuit-breaker/circuit-breaker.module';
import { DomainEventsModule } from '../domain-events/domain-events.module';

@Module({
  imports: [MetricsModule, CircuitBreakerModule, DomainEventsModule],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService, RemediationService, RestartService, FeatureFlagsService, DiagnosticsLlmService, RolesGuard],
  exports: [DiagnosticsService, FeatureFlagsService],
})
export class DiagnosticsModule {}
