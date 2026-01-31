import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { PrismaService } from '../database/postgres/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentStatus } from '@prisma/client';
import { LedgerEntryDirection } from '@prisma/client';
import { PaginationUtil, PaginationParams } from '../common/utils/pagination.util';
import { Prisma } from '@prisma/client';
import { InvoicesTransactionService } from '../invoices/invoices-transaction.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { LedgerService } from '../ledger/ledger.service';
import { FraudRiskService } from '../fraud-detection/fraud-risk.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new StructuredLoggerService(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private invoicesTransactionService: InvoicesTransactionService,
    private activityLogService: ActivityLogService,
    private ledgerService: LedgerService,
    private fraudRiskService: FraudRiskService,
  ) {}

  async create(organizationId: string, userId: string, createPaymentDto: CreatePaymentDto) {
    const orgBlock = await this.fraudRiskService.shouldBlockOrganization(organizationId);
    if (orgBlock.block) {
      this.logger.warn('Payment creation blocked', {
        organizationId,
        reason: orgBlock.reason ?? 'organization blocked',
      });
      throw new ForbiddenException(
        orgBlock.reason ?? 'Organization blocked by fraud policy',
      );
    }

    // Default to COMPLETED status if not specified
    const paymentStatus = createPaymentDto.status || PaymentStatus.COMPLETED;
    const processedAt = createPaymentDto.processedAt 
      ? new Date(createPaymentDto.processedAt) 
      : paymentStatus === PaymentStatus.COMPLETED 
        ? new Date() 
        : null;

    let payment;
    let invoiceStatus;
    let totalPaid;
    let remaining;

    // If payment is for an invoice, use transaction service to handle balance
    if (createPaymentDto.invoiceId && paymentStatus === PaymentStatus.COMPLETED) {
      const result = await this.invoicesTransactionService.processPayment(organizationId, {
        invoiceId: createPaymentDto.invoiceId,
        amount: createPaymentDto.amount,
        method: createPaymentDto.method,
        transactionId: createPaymentDto.transactionId || `TXN-${Date.now()}`,
        currency: createPaymentDto.currency,
        notes: createPaymentDto.notes,
      });

      // Fetch payment with invoice relation for activity logging
      payment = await this.prisma.payment.findUnique({
        where: { id: result.payment.id },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
              status: true,
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found after creation');
      }

      invoiceStatus = result.invoiceStatus;
      totalPaid = result.totalPaid;
      remaining = result.remaining;
    } else {
      // Standalone payment or non-completed payment
      if (createPaymentDto.invoiceId) {
        const invoice = await this.prisma.invoice.findFirst({
          where: {
            id: createPaymentDto.invoiceId,
            organizationId,
          },
        });

        if (!invoice) {
          throw new NotFoundException('Invoice not found');
        }
      }

      payment = await this.prisma.payment.create({
        data: {
          organizationId,
          invoiceId: createPaymentDto.invoiceId,
          amount: new Prisma.Decimal(createPaymentDto.amount),
          currency: createPaymentDto.currency || 'USD',
          method: createPaymentDto.method,
          status: paymentStatus,
          transactionId: createPaymentDto.transactionId || `TXN-${Date.now()}`,
          processedAt,
          notes: createPaymentDto.notes,
        },
        include: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
              status: true,
            },
          },
        },
      });

      if (createPaymentDto.invoiceId && paymentStatus === PaymentStatus.COMPLETED) {
        await this.updateInvoiceStatus(createPaymentDto.invoiceId, organizationId);
      }
    }

    // Ledger: post COMPLETED payments only (idempotent by referenceType + referenceId)
    if (payment.status === PaymentStatus.COMPLETED) {
      await this.postPaymentToLedger(organizationId, payment);
    }

    // Log activity
    try {
      await this.activityLogService.create(
        organizationId,
        userId,
        {
          action: 'CREATE',
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: {
            amount: Number(payment.amount),
            currency: payment.currency,
            method: payment.method,
            status: payment.status,
            invoiceId: payment.invoiceId,
            invoiceNumber: payment.invoice?.invoiceNumber,
            invoiceStatus,
            totalPaid,
            remaining,
          },
        },
      );
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to log payment activity', undefined, e);
    }

    return payment;
  }

  /**
   * Post a COMPLETED payment to the ledger (debit ASSET, credit REVENUE).
   * Idempotent via LedgerService (referenceType + referenceId).
   * Throws if ASSET or REVENUE accounts are not configured for the org.
   */
  private async postPaymentToLedger(
    organizationId: string,
    payment: { id: string; amount: Prisma.Decimal; currency: string },
  ): Promise<void> {
    const accounts = await this.ledgerService.getAccounts(organizationId);
    const assetAccount = accounts.find((a) => a.type === 'ASSET');
    const revenueAccount = accounts.find((a) => a.type === 'REVENUE');
    if (!assetAccount || !revenueAccount) {
      throw new BadRequestException(
        'Ledger not configured: ASSET and REVENUE accounts are required for the organization. Create them via the ledger accounts API.',
      );
    }
    const amountCents = Math.round(Number(payment.amount) * 100);
    if (amountCents <= 0) {
      return;
    }
    await this.ledgerService.postTransaction(organizationId, {
      referenceType: 'PAYMENT',
      referenceId: payment.id,
      entries: [
        { accountId: assetAccount.id, direction: LedgerEntryDirection.DEBIT, amount: amountCents },
        { accountId: revenueAccount.id, direction: LedgerEntryDirection.CREDIT, amount: amountCents },
      ],
    });
  }

  async findAll(
    organizationId: string,
    pagination: PaginationParams,
    status?: PaymentStatus,
    invoiceId?: string,
  ) {
    const { skip, take } = PaginationUtil.parseParams(pagination.page, pagination.limit);

    const where: Prisma.PaymentWhereInput = {
      organizationId,
      deletedAt: null,
      ...(status && { status }),
      ...(invoiceId && { invoiceId }),
    };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        include: {
          invoice: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              invoiceNumber: true,
              total: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      meta: PaginationUtil.createMeta(
        pagination.page || 1,
        pagination.limit || 10,
        total,
      ),
    };
  }

  async findOne(organizationId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        invoice: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            client: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async update(organizationId: string, id: string, updatePaymentDto: UpdatePaymentDto) {
    const payment = await this.findOne(organizationId, id);

    const updateData: any = {};

    if (updatePaymentDto.amount !== undefined)
      updateData.amount = new Prisma.Decimal(updatePaymentDto.amount);
    if (updatePaymentDto.currency) updateData.currency = updatePaymentDto.currency;
    if (updatePaymentDto.method) updateData.method = updatePaymentDto.method;
    if (updatePaymentDto.status !== undefined) {
      if (
        updatePaymentDto.status === PaymentStatus.COMPLETED &&
        payment.status !== PaymentStatus.COMPLETED
      ) {
        const orgBlock = await this.fraudRiskService.shouldBlockOrganization(organizationId);
        if (orgBlock.block) {
          this.logger.warn('Payment update blocked (org)', {
            organizationId,
            paymentId: id,
            reason: orgBlock.reason ?? 'organization blocked',
          });
          throw new ForbiddenException(
            orgBlock.reason ?? 'Organization blocked by fraud policy',
          );
        }
        const paymentBlock = await this.fraudRiskService.shouldBlockPayment(organizationId, id);
        if (paymentBlock.block) {
          this.logger.warn('Payment update blocked (payment)', {
            organizationId,
            paymentId: id,
            reason: paymentBlock.reason ?? 'payment blocked',
          });
          throw new ForbiddenException(
            paymentBlock.reason ?? 'Payment blocked by fraud policy',
          );
        }
      }
      updateData.status = updatePaymentDto.status;
    }
    if (updatePaymentDto.transactionId !== undefined)
      updateData.transactionId = updatePaymentDto.transactionId;
    if (updatePaymentDto.processedAt !== undefined)
      updateData.processedAt = updatePaymentDto.processedAt ? new Date(updatePaymentDto.processedAt) : null;
    if (updatePaymentDto.notes !== undefined) updateData.notes = updatePaymentDto.notes;

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: updateData,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
          },
        },
      },
    });

    if (
      payment.invoiceId &&
      updatePaymentDto.status === PaymentStatus.COMPLETED &&
      payment.status !== PaymentStatus.COMPLETED
    ) {
      await this.updateInvoiceStatus(payment.invoiceId, organizationId);
    }

    return updatedPayment;
  }

  async remove(organizationId: string, id: string) {
    const payment = await this.findOne(organizationId, id);

    // Check if payment is completed - if so, soft delete only
    if (payment.status === 'COMPLETED') {
      await this.prisma.payment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { message: 'Payment soft deleted (was completed)' };
    }

    // Hard delete if not completed
    await this.prisma.payment.delete({ where: { id } });
    return { message: 'Payment deleted successfully' };
  }

  private async updateInvoiceStatus(invoiceId: string, organizationId: string) {
      const invoice = await this.prisma.invoice.findFirst({
        where: {
          id: invoiceId,
          organizationId,
          deletedAt: null,
        },
        include: {
          payments: {
            where: {
              status: PaymentStatus.COMPLETED,
              deletedAt: null,
            },
          },
        },
      });

    if (!invoice) {
      return;
    }

    const totalPaid = invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );

    let newStatus = invoice.status;

    if (totalPaid >= Number(invoice.total)) {
      newStatus = 'PAID' as any;
    } else if (totalPaid > 0) {
      newStatus = 'SENT' as any;
    }

    if (newStatus !== invoice.status) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: newStatus },
      });
    }
  }
}
