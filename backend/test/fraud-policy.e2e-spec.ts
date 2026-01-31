import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/postgres/prisma.service';
import { PaymentsService } from '../src/payments/payments.service';
import { LedgerBootstrapService } from '../src/ledger/ledger-bootstrap.service';

/**
 * E2E: Fraud policy blocking. When org has too many flagged signals, payment creation returns 403.
 * Uses real test database.
 */
describe('Fraud policy blocking (e2e)', () => {
  let prisma: PrismaService;
  let paymentsService: PaymentsService;
  let ledgerBootstrap: LedgerBootstrapService;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = module.get(PrismaService);
    paymentsService = module.get(PaymentsService);
    ledgerBootstrap = module.get(LedgerBootstrapService);

    const org = await prisma.organization.create({
      data: { name: 'E2E Fraud Org', slug: `e2e-fraud-${Date.now()}` },
    });
    orgId = org.id;
    await ledgerBootstrap.ensureDefaults(orgId);

    const role = await prisma.role.create({
      data: { organizationId: orgId, name: 'ADMIN', permissions: {} },
    });
    const user = await prisma.user.create({
      data: {
        email: `e2e-fraud-${Date.now()}@test.local`,
        passwordHash: 'hash',
        firstName: 'E2E',
        lastName: 'Fraud',
      },
    });
    userId = user.id;
    await prisma.userOrganization.create({
      data: { userId, organizationId: orgId, roleId: role.id },
    });

    // Create 5+ flagged fraud signals so shouldBlockOrganization returns true (max 5 in 24h)
    for (let i = 0; i < 6; i++) {
      await prisma.fraudSignal.create({
        data: {
          organizationId: orgId,
          entityType: 'PAYMENT',
          entityId: `e2e-fraud-${i}-${Date.now()}`,
          riskScore: 90,
          isFlagged: true,
          factors: {},
        },
      });
    }
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.fraudSignal.deleteMany({ where: { organizationId: orgId } });
      await prisma.payment.deleteMany({ where: { organizationId: orgId } });
      await prisma.userOrganization.deleteMany({ where: { organizationId: orgId } });
      await prisma.role.deleteMany({ where: { organizationId: orgId } });
      await prisma.ledgerAccount.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it('payment creation returns 403 when org is blocked by fraud policy', async () => {
    await expect(
      paymentsService.create(orgId, userId, {
        amount: 10,
        currency: 'USD',
        method: 'CASH',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
