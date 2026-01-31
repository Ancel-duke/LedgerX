import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/postgres/prisma.service';
import { LedgerService } from '../src/ledger/ledger.service';
import { LedgerBootstrapService } from '../src/ledger/ledger-bootstrap.service';
import { LedgerEntryDirection } from '@prisma/client';

/**
 * E2E: Ledger balance invariants and double-posting failure.
 * Uses real test database (DATABASE_URL). Ensures debits === credits and duplicate reference fails.
 */
describe('Ledger invariants (e2e)', () => {
  let prisma: PrismaService;
  let ledgerService: LedgerService;
  let ledgerBootstrap: LedgerBootstrapService;
  let orgId: string;
  let assetId: string;
  let revenueId: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = module.get(PrismaService);
    ledgerService = module.get(LedgerService);
    ledgerBootstrap = module.get(LedgerBootstrapService);

    const org = await prisma.organization.create({
      data: {
        name: 'E2E Ledger Org',
        slug: `e2e-ledger-${Date.now()}`,
      },
    });
    orgId = org.id;
    await ledgerBootstrap.ensureDefaults(orgId);
    const accounts = await ledgerService.getAccounts(orgId);
    const asset = accounts.find((a) => a.type === 'ASSET');
    const revenue = accounts.find((a) => a.type === 'REVENUE');
    if (!asset || !revenue) throw new Error('Default accounts not found');
    assetId = asset.id;
    revenueId = revenue.id;
  });

  afterAll(async () => {
    if (orgId) {
      await prisma.ledgerTransaction.deleteMany({ where: { organizationId: orgId } });
      await prisma.ledgerAccount.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
  });

  it('invariant: debits equal credits after posting', async () => {
    const refId = `e2e-balance-${Date.now()}`;
    const amount = 1000;
    await ledgerService.postTransaction(orgId, {
      referenceType: 'TEST',
      referenceId: refId,
      entries: [
        { accountId: assetId, direction: LedgerEntryDirection.DEBIT, amount },
        { accountId: revenueId, direction: LedgerEntryDirection.CREDIT, amount },
      ],
    });

    const balances = await ledgerService.getBalances(orgId);
    const totalDebitsMinusCredits = balances.reduce((sum, b) => sum + BigInt(b.balance), BigInt(0));
    expect(totalDebitsMinusCredits).toBe(BigInt(0));
  });

  it('double posting same reference fails with ConflictException', async () => {
    const refId = `e2e-double-${Date.now()}`;
    const amount = 500;
    await ledgerService.postTransaction(orgId, {
      referenceType: 'TEST',
      referenceId: refId,
      entries: [
        { accountId: assetId, direction: LedgerEntryDirection.DEBIT, amount },
        { accountId: revenueId, direction: LedgerEntryDirection.CREDIT, amount },
      ],
    });

    await expect(
      ledgerService.postTransaction(orgId, {
        referenceType: 'TEST',
        referenceId: refId,
        entries: [
          { accountId: assetId, direction: LedgerEntryDirection.DEBIT, amount: 999 },
          { accountId: revenueId, direction: LedgerEntryDirection.CREDIT, amount: 999 },
        ],
      }),
    ).rejects.toThrow(ConflictException);
  });
});
