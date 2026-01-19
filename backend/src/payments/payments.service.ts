import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentStatus } from '@prisma/client';
import { PaginationUtil, PaginationParams } from '../common/utils/pagination.util';
import { Prisma } from '@prisma/client';
import { InvoicesTransactionService } from '../invoices/invoices-transaction.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private invoicesTransactionService: InvoicesTransactionService,
    private activityLogService: ActivityLogService,
  ) {}

  async create(organizationId: string, userId: string, createPaymentDto: CreatePaymentDto) {
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
      // Log error but don't fail payment creation
      console.error('Failed to log payment activity:', error);
    }

    return payment;
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
    if (updatePaymentDto.status !== undefined) updateData.status = updatePaymentDto.status;
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
