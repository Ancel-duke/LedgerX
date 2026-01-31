import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { LedgerEntryDirection } from '@prisma/client';
import { PostTransactionDto } from './dto/post-transaction.dto';
import { CreateLedgerAccountDto } from './dto/create-account.dto';
import { DomainEventBus } from '../domain-events/domain-event-bus.service';
import { LEDGER_TRANSACTION_POSTED } from '../domain-events/events';
import { createHash } from 'crypto';
import { PaginationUtil, PaginationParams } from '../common/utils/pagination.util';
import { Prisma } from '@prisma/client';

/** Ledger Core: append-only accounting truth layer. No update/delete on ledger tables. */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  /**
   * Post a balanced ledger transaction. Enforces: total debits === total credits, integer amounts.
   * Emits LedgerTransactionPostedEvent on success.
   */
  async postTransaction(
    organizationId: string,
    dto: PostTransactionDto,
  ): Promise<{ id: string; createdAt: Date }> {
    const { referenceType, referenceId, entries } = dto;

    // Integer amounts: ensure no floats (DTO uses @IsInt; double-check for BigInt storage)
    for (const e of entries) {
      if (!Number.isInteger(e.amount) || e.amount < 0) {
        throw new BadRequestException(
          'All amounts must be non-negative integers',
        );
      }
    }

    // Balanced transaction: sum(debits) === sum(credits)
    let totalDebits = 0;
    let totalCredits = 0;
    for (const e of entries) {
      if (e.direction === LedgerEntryDirection.DEBIT) {
        totalDebits += e.amount;
      } else {
        totalCredits += e.amount;
      }
    }
    if (totalDebits !== totalCredits) {
      throw new BadRequestException(
        `Transaction must balance: debits (${totalDebits}) must equal credits (${totalCredits})`,
      );
    }

    // Verify all accounts exist and belong to organization
    const accountIds = [...new Set(entries.map((e) => e.accountId))];
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: {
        id: { in: accountIds },
        organizationId,
      },
    });
    if (accounts.length !== accountIds.length) {
      const foundIds = new Set(accounts.map((a) => a.id));
      const missing = accountIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Ledger account(s) not found or not in organization: ${missing.join(', ')}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Idempotency: one transaction per (org, referenceType, referenceId)
      const existing = await tx.ledgerTransaction.findUnique({
        where: {
          organizationId_referenceType_referenceId: {
            organizationId,
            referenceType,
            referenceId,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Ledger transaction already exists for ${referenceType}:${referenceId}`,
        );
      }

      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          organizationId,
          referenceType,
          referenceId,
        },
      });

      await tx.ledgerEntry.createMany({
        data: entries.map((e) => ({
          ledgerTransactionId: ledgerTx.id,
          accountId: e.accountId,
          direction: e.direction,
          amount: BigInt(e.amount),
        })),
      });

      // Chain hash: previousHash from most recent transaction in org, currentHash = hash(previousHash + txId + entries)
      const lastTx = await tx.ledgerTransaction.findFirst({
        where: { organizationId, id: { not: ledgerTx.id } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      const lastHashRow = lastTx
        ? await tx.ledgerHash.findUnique({
            where: { ledgerTransactionId: lastTx.id },
            select: { currentHash: true },
          })
        : null;
      const previousHash = lastHashRow?.currentHash ?? null;
      const entriesPayload = entries
        .map((e) => `${e.accountId}:${e.direction}:${e.amount}`)
        .sort()
        .join('|');
      const currentHash = createHash('sha256')
        .update(`${previousHash ?? ''}|${ledgerTx.id}|${entriesPayload}`)
        .digest('hex');

      await tx.ledgerHash.create({
        data: {
          ledgerTransactionId: ledgerTx.id,
          previousHash,
          currentHash,
        },
      });

      return { id: ledgerTx.id, createdAt: ledgerTx.createdAt };
    });

    this.domainEventBus.publish(LEDGER_TRANSACTION_POSTED, {
      organizationId,
      ledgerTransactionId: result.id,
      referenceType,
      referenceId,
      createdAt: result.createdAt,
    });

    return result;
  }

  // --- Read-only queries ---

  /** Get balance per account (sum of DEBIT - sum of CREDIT) for given account IDs, or all accounts in org. */
  async getBalances(
    organizationId: string,
    accountIds?: string[],
  ): Promise<{ accountId: string; balance: string }[]> {
    const whereAccount: Prisma.LedgerAccountWhereInput = {
      organizationId,
    };
    if (accountIds?.length) {
      whereAccount.id = { in: accountIds };
    }
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: whereAccount,
      select: { id: true },
    });
    if (accounts.length === 0) {
      return [];
    }
    const ids = accounts.map((a) => a.id);

    const entries = await this.prisma.ledgerEntry.findMany({
      where: { accountId: { in: ids } },
      select: { accountId: true, direction: true, amount: true },
    });

    const balances = new Map<string, bigint>();
    for (const e of entries) {
      const current = balances.get(e.accountId) ?? BigInt(0);
      const delta = e.direction === LedgerEntryDirection.DEBIT ? e.amount : -e.amount;
      balances.set(e.accountId, current + delta);
    }
    return ids.map((id) => ({
      accountId: id,
      balance: (balances.get(id) ?? BigInt(0)).toString(),
    }));
  }

  /** List ledger transactions with optional pagination and filters. */
  async getTransactions(
    organizationId: string,
    pagination: PaginationParams,
    filters?: { referenceType?: string; referenceId?: string },
  ) {
    const { skip, take } = PaginationUtil.parseParams(
      pagination.page,
      pagination.limit,
    );
    const where: Prisma.LedgerTransactionWhereInput = {
      organizationId,
      ...(filters?.referenceType && { referenceType: filters.referenceType }),
      ...(filters?.referenceId && { referenceId: filters.referenceId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.ledgerTransaction.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          entries: {
            include: {
              account: { select: { id: true, name: true, type: true, currency: true } },
            },
          },
        },
      }),
      this.prisma.ledgerTransaction.count({ where }),
    ]);
    return {
      data,
      meta: PaginationUtil.createMeta(
        pagination.page ?? 1,
        pagination.limit ?? 10,
        total,
      ),
    };
  }

  /** Get a single ledger transaction by ID. */
  async getTransactionById(
    organizationId: string,
    id: string,
  ) {
    const tx = await this.prisma.ledgerTransaction.findFirst({
      where: { id, organizationId },
      include: {
        entries: {
          include: {
            account: { select: { id: true, name: true, type: true, currency: true } },
          },
        },
        hash: true,
      },
    });
    if (!tx) {
      throw new NotFoundException('Ledger transaction not found');
    }
    return tx;
  }

  /** Create a ledger account (additive; accounts are referenced by entries). */
  async createAccount(
    organizationId: string,
    dto: CreateLedgerAccountDto,
  ) {
    return this.prisma.ledgerAccount.create({
      data: {
        organizationId,
        name: dto.name,
        type: dto.type,
        currency: dto.currency ?? 'USD',
      },
    });
  }

  /** List ledger accounts for an organization (read-only listing). */
  async getAccounts(organizationId: string) {
    return this.prisma.ledgerAccount.findMany({
      where: { organizationId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }
}
