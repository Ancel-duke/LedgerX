import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from './config/config.module';
import { PostgresModule } from './database/postgres/postgres.module';
import { MongoModule } from './database/mongo/mongo.module';
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

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    DomainEventsModule,
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
  ],
})
export class AppModule {}
