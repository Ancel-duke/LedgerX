import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { LedgerAccountType } from '@prisma/client';

const DEFAULT_CASH_NAME = 'Cash';
const DEFAULT_REVENUE_NAME = 'Revenue';
const DEFAULT_CURRENCY = 'USD';

/**
 * Ensures default ledger accounts exist for an organization.
 * Idempotent: safe to call on org creation retry; does not create on every request.
 */
@Injectable()
export class LedgerBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure default ledger accounts (Cash ASSET, Revenue REVENUE) exist for the org.
   * Idempotent: uses upsert so duplicate calls do not create duplicate accounts.
   */
  async ensureDefaults(organizationId: string): Promise<void> {
    await this.prisma.ledgerAccount.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: DEFAULT_CASH_NAME,
        },
      },
      create: {
        organizationId,
        name: DEFAULT_CASH_NAME,
        type: LedgerAccountType.ASSET,
        currency: DEFAULT_CURRENCY,
      },
      update: {},
    });

    await this.prisma.ledgerAccount.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: DEFAULT_REVENUE_NAME,
        },
      },
      create: {
        organizationId,
        name: DEFAULT_REVENUE_NAME,
        type: LedgerAccountType.REVENUE,
        currency: DEFAULT_CURRENCY,
      },
      update: {},
    });
  }
}
