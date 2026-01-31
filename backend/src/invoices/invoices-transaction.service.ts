import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { Prisma, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { DomainEventBus } from '../domain-events/domain-event-bus.service';
import { INVOICE_OVERDUE } from '../domain-events/events';

/**
 * Example service methods demonstrating transaction usage for invoice and payment flows
 * This service shows how to use Prisma transactions to ensure data consistency
 */
@Injectable()
export class InvoicesTransactionService {
  constructor(
    private prisma: PrismaService,
    private domainEventBus: DomainEventBus,
  ) {}

  /**
   * Create invoice with items in a transaction
   * Ensures all items are created or none are created
   */
  async createInvoiceWithItems(
    organizationId: string,
    data: {
      invoiceNumber: string;
      clientId: string;
      issueDate: Date;
      dueDate: Date;
      currency?: string;
      taxRate?: number;
      notes?: string;
      items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
      }>;
    },
  ) {
    // Calculate totals
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    const taxRate = data.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Verify client belongs to organization
    const client = await this.prisma.client.findFirst({
      where: {
        id: data.clientId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found or inactive');
    }

    // Use transaction to create invoice and items atomically
    return await this.prisma.$transaction(async (tx) => {
      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: data.invoiceNumber,
          organizationId,
          clientId: data.clientId,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          status: InvoiceStatus.DRAFT,
          subtotal: new Prisma.Decimal(subtotal),
          taxRate: new Prisma.Decimal(taxRate),
          taxAmount: new Prisma.Decimal(taxAmount),
          total: new Prisma.Decimal(total),
          currency: data.currency || 'USD',
          notes: data.notes,
        },
      });

      // Create invoice items
      const items = await Promise.all(
        data.items.map((item) =>
          tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              description: item.description,
              quantity: new Prisma.Decimal(item.quantity),
              unitPrice: new Prisma.Decimal(item.unitPrice),
              total: new Prisma.Decimal(item.quantity * item.unitPrice),
            },
          }),
        ),
      );

      return {
        ...invoice,
        items,
      };
    });
  }

  /**
   * Process payment and update invoice status in a transaction
   * Ensures payment is recorded and invoice status is updated atomically
   */
  async processPayment(
    organizationId: string,
    data: {
      invoiceId: string;
      amount: number;
      method: string;
      transactionId: string;
      currency?: string;
      notes?: string;
    },
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Verify invoice belongs to organization and is not paid
      const invoice = await tx.invoice.findFirst({
        where: {
          id: data.invoiceId,
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
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Invoice is already paid');
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('Cannot process payment for cancelled invoice');
      }

      // Calculate total paid amount
      const totalPaid = invoice.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const newTotalPaid = totalPaid + data.amount;
      const invoiceTotal = Number(invoice.total);

      // Validate payment amount
      if (newTotalPaid > invoiceTotal) {
        throw new BadRequestException(
          `Payment amount exceeds invoice total. Remaining: ${invoiceTotal - totalPaid}`,
        );
      }

      // Create payment
      const payment = await tx.payment.create({
        data: {
          organizationId,
          invoiceId: data.invoiceId,
          amount: new Prisma.Decimal(data.amount),
          currency: data.currency || 'USD',
          method: data.method as any,
          status: PaymentStatus.COMPLETED,
          transactionId: data.transactionId,
          processedAt: new Date(),
          notes: data.notes,
        },
      });

      // Update invoice status based on payment
      let newStatus: InvoiceStatus = invoice.status;
      if (newTotalPaid >= invoiceTotal) {
        newStatus = InvoiceStatus.PAID;
      } else if (newTotalPaid > 0 && invoice.status === InvoiceStatus.DRAFT) {
        newStatus = InvoiceStatus.SENT;
      }

      // Update invoice status if changed
      if (newStatus !== invoice.status) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: newStatus },
        });
      }

      return {
        payment,
        invoiceStatus: newStatus,
        totalPaid: newTotalPaid,
        remaining: invoiceTotal - newTotalPaid,
      };
    });
  }

  /**
   * Refund payment and update invoice status in a transaction
   */
  async refundPayment(
    organizationId: string,
    paymentId: string,
    refundAmount?: number,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      // Find payment
      const payment = await tx.payment.findFirst({
        where: {
          id: paymentId,
          organizationId,
          status: PaymentStatus.COMPLETED,
          deletedAt: null,
        },
        include: {
          invoice: {
            include: {
              payments: {
                where: {
                  status: PaymentStatus.COMPLETED,
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found or already refunded');
      }

      const refundAmt = refundAmount || Number(payment.amount);

      if (refundAmt > Number(payment.amount)) {
        throw new BadRequestException('Refund amount cannot exceed payment amount');
      }

      // Update payment status to refunded
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REFUNDED,
          notes: payment.notes
            ? `${payment.notes}\n[Refunded: ${refundAmt}]`
            : `[Refunded: ${refundAmt}]`,
        },
      });

      // Update invoice status if needed
      if (payment.invoice) {
        const invoice = payment.invoice;
        const remainingPayments = invoice.payments.filter((p) => p.id !== paymentId);
        const totalPaid = remainingPayments.reduce(
          (sum, p) => sum + Number(p.amount),
          0,
        );
        const invoiceTotal = Number(invoice.total);

        let newStatus = invoice.status;
        if (totalPaid === 0) {
          newStatus = InvoiceStatus.SENT;
        } else if (totalPaid < invoiceTotal) {
          newStatus = InvoiceStatus.SENT;
        }

        if (newStatus !== invoice.status) {
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: newStatus },
          });
        }
      }

      return {
        paymentId,
        refundAmount: refundAmt,
        status: PaymentStatus.REFUNDED,
      };
    });
  }

  /**
   * Delete invoice with soft delete (marks as deleted, preserves data)
   */
  async softDeleteInvoice(organizationId: string, invoiceId: string) {
    return await this.prisma.$transaction(async (tx) => {
      // Verify invoice belongs to organization
      const invoice = await tx.invoice.findFirst({
        where: {
          id: invoiceId,
          organizationId,
          deletedAt: null,
        },
        include: {
          payments: {
            where: {
              deletedAt: null,
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Check if invoice has completed payments
      const hasCompletedPayments = invoice.payments.some(
        (p) => p.status === PaymentStatus.COMPLETED,
      );

      if (hasCompletedPayments) {
        throw new BadRequestException(
          'Cannot delete invoice with completed payments. Cancel instead.',
        );
      }

      // Soft delete invoice and items
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { deletedAt: new Date() },
      });

      await tx.invoiceItem.updateMany({
        where: { invoiceId, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      // Soft delete related payments
      await tx.payment.updateMany({
        where: {
          invoiceId,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });

      return { message: 'Invoice deleted successfully' };
    });
  }

  /**
   * Mark invoice as overdue in a transaction
   * Can be run as a scheduled job. Emits InvoiceOverdue domain event after successful commit.
   */
  async markOverdueInvoices(organizationId?: string) {
    const where: Prisma.InvoiceWhereInput = {
      status: {
        in: [InvoiceStatus.SENT, InvoiceStatus.DRAFT],
      },
      dueDate: {
        lt: new Date(),
      },
      deletedAt: null,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const toUpdate = await tx.invoice.findMany({
        where,
        select: { id: true, organizationId: true },
      });
      const ids = toUpdate.map((i) => i.id);
      if (ids.length === 0) {
        return { count: 0, invoiceIds: [] as string[], organizationId: organizationId ?? null };
      }
      await tx.invoice.updateMany({
        where: { id: { in: ids } },
        data: { status: InvoiceStatus.OVERDUE },
      });
      const orgId = organizationId ?? toUpdate[0]?.organizationId ?? null;
      return { count: ids.length, invoiceIds: ids, organizationId: orgId };
    });

    if (result.count > 0) {
      this.domainEventBus.publish(INVOICE_OVERDUE, {
        organizationId: result.organizationId,
        invoiceIds: result.invoiceIds,
        count: result.count,
        occurredAt: new Date(),
      });
    }

    return {
      count: result.count,
      message: `Marked ${result.count} invoice(s) as overdue`,
    };
  }
}
