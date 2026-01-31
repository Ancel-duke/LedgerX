import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { PostgresModule } from './database/postgres/postgres.module';
import { MongoModule } from './database/mongo/mongo.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { RequestContextModule } from './common/request-context/request-context.module';
import { InFlightFinancialModule } from './common/in-flight-financial/in-flight-financial.module';
import { ScheduledJobsModule } from './common/scheduled-jobs/scheduled-jobs.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { SensitiveEndpointsRateLimitGuard } from './common/rate-limit/sensitive-endpoints-rate-limit.guard';
import { CircuitBreakerModule } from './common/circuit-breaker/circuit-breaker.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ClientsModule } from './clients/clients.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { LedgerModule } from './ledger/ledger.module';
import { DomainEventsModule } from './domain-events/domain-events.module';
import { AuditComplianceModule } from './audit-compliance/audit-compliance.module';
import { FraudDetectionModule } from './fraud-detection/fraud-detection.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DomainEventsModule,
    RequestContextModule,
    InFlightFinancialModule,
    ScheduledJobsModule,
    RateLimitModule,
    HealthModule,
    MetricsModule,
    CircuitBreakerModule,
    PostgresModule,
    MongoModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ClientsModule,
    InvoicesModule,
    PaymentsModule,
    AnalyticsModule,
    ActivityLogModule,
    LedgerModule,
    AuditComplianceModule,
    FraudDetectionModule,
    DiagnosticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SensitiveEndpointsRateLimitGuard,
    },
  ],
})
export class AppModule {}
