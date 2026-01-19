import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceStatus } from '@prisma/client';
import { PaginationUtil, PaginationParams } from '../common/utils/pagination.util';
import { Prisma } from '@prisma/client';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private activityLogService: ActivityLogService,
  ) {}

  async create(organizationId: string, userId: string | undefined, createInvoiceDto: CreateInvoiceDto) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }
    
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    // Verify client belongs to organization
    const client = await this.prisma.client.findFirst({
      where: {
        id: createInvoiceDto.clientId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found or inactive');
    }

    // Validate items array
    if (!createInvoiceDto.items || createInvoiceDto.items.length === 0) {
      throw new BadRequestException('Invoice must have at least one item');
    }

    const invoiceNumber =
      createInvoiceDto.invoiceNumber || (await this.generateInvoiceNumber(organizationId));

    const subtotal = createInvoiceDto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    const taxRate = createInvoiceDto.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        organizationId,
        clientId: createInvoiceDto.clientId,
        issueDate: new Date(createInvoiceDto.issueDate),
        dueDate: new Date(createInvoiceDto.dueDate),
        status: createInvoiceDto.status || InvoiceStatus.DRAFT,
        subtotal: new Prisma.Decimal(subtotal),
        taxRate: new Prisma.Decimal(taxRate),
        taxAmount: new Prisma.Decimal(taxAmount),
        total: new Prisma.Decimal(total),
        currency: createInvoiceDto.currency || 'USD',
        notes: createInvoiceDto.notes,
        items: {
          create: createInvoiceDto.items.map((item) => ({
            description: item.description,
            quantity: new Prisma.Decimal(item.quantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            total: new Prisma.Decimal(item.quantity * item.unitPrice),
          })),
        },
      },
      include: {
        items: true,
        client: true,
      },
    });

    // Log activity
    await this.activityLogService.create(
      organizationId,
      userId,
      {
        action: 'CREATE',
        entityType: 'INVOICE',
        entityId: invoice.id,
        metadata: {
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          clientName: invoice.client?.name,
          total: Number(invoice.total),
          status: invoice.status,
          itemCount: invoice.items.length,
        },
      },
    ).catch((err) => {
      // Log error but don't fail invoice creation
      console.error('Failed to log invoice creation activity:', err);
    });

    return invoice;
  }

  async findAll(organizationId: string, pagination: PaginationParams, status?: InvoiceStatus) {
    const { skip, take } = PaginationUtil.parseParams(pagination.page, pagination.limit);

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null,
      ...(status && { status }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take,
        include: {
          items: true,
          client: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          payments: {
            where: {
              status: 'COMPLETED',
              deletedAt: null,
            },
            select: {
              id: true,
              amount: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: PaginationUtil.createMeta(
        pagination.page || 1,
        pagination.limit || 10,
        total,
      ),
    };
  }

  async findOne(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        items: true,
        client: true,
        payments: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            amount: true,
            status: true,
            method: true,
            processedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async update(organizationId: string, id: string, updateInvoiceDto: UpdateInvoiceDto) {
    const invoice = await this.findOne(organizationId, id);

    const updateData: any = {};

    if (updateInvoiceDto.issueDate) updateData.issueDate = new Date(updateInvoiceDto.issueDate);
    if (updateInvoiceDto.dueDate) updateData.dueDate = new Date(updateInvoiceDto.dueDate);
    if (updateInvoiceDto.status) updateData.status = updateInvoiceDto.status;
    if (updateInvoiceDto.currency) updateData.currency = updateInvoiceDto.currency;
    if (updateInvoiceDto.notes !== undefined) updateData.notes = updateInvoiceDto.notes;

    if (updateInvoiceDto.clientId && updateInvoiceDto.clientId !== invoice.clientId) {
      const client = await this.prisma.client.findFirst({
        where: {
          id: updateInvoiceDto.clientId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!client) {
        throw new NotFoundException('Client not found or inactive');
      }

      updateData.clientId = updateInvoiceDto.clientId;
    }

    if (updateInvoiceDto.items) {
      // Soft delete existing items
      await this.prisma.invoiceItem.updateMany({
        where: { invoiceId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      const subtotal = updateInvoiceDto.items.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
        0,
      );

      const taxRate = updateInvoiceDto.taxRate ?? Number(invoice.taxRate);
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      updateData.subtotal = new Prisma.Decimal(subtotal);
      updateData.taxRate = new Prisma.Decimal(taxRate);
      updateData.taxAmount = new Prisma.Decimal(taxAmount);
      updateData.total = new Prisma.Decimal(total);

      await this.prisma.invoiceItem.createMany({
        data: updateInvoiceDto.items.map((item) => ({
          invoiceId: id,
          description: item.description!,
          quantity: new Prisma.Decimal(item.quantity!),
          unitPrice: new Prisma.Decimal(item.unitPrice!),
          total: new Prisma.Decimal(item.quantity! * item.unitPrice!),
        })),
      });
    } else if (updateInvoiceDto.taxRate !== undefined) {
      const subtotal = Number(invoice.subtotal);
      const taxRate = updateInvoiceDto.taxRate;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      updateData.taxRate = new Prisma.Decimal(taxRate);
      updateData.taxAmount = new Prisma.Decimal(taxAmount);
      updateData.total = new Prisma.Decimal(total);
    }

    const updatedInvoice = await this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          where: {
            deletedAt: null,
          },
        },
        client: true,
      },
    });

    return updatedInvoice;
  }

  async remove(organizationId: string, id: string) {
    const invoice = await this.findOne(organizationId, id);

    // Check if invoice has completed payments
    const hasCompletedPayments = await this.prisma.payment.count({
      where: {
        invoiceId: id,
        status: 'COMPLETED',
        deletedAt: null,
      },
    });

    if (hasCompletedPayments > 0) {
      throw new BadRequestException(
        'Cannot delete invoice with completed payments. Use soft delete instead.',
      );
    }

    // Soft delete invoice, items, and payments
    await this.prisma.$transaction([
      this.prisma.invoice.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.invoiceItem.updateMany({
        where: { invoiceId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.payment.updateMany({
        where: { invoiceId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    return { message: 'Invoice deleted successfully' };
  }

  private async generateInvoiceNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

      const lastInvoice = await this.prisma.invoice.findFirst({
        where: {
          organizationId,
          invoiceNumber: {
            startsWith: prefix,
          },
          deletedAt: null,
        },
        orderBy: {
          invoiceNumber: 'desc',
        },
      });

    if (!lastInvoice) {
      return `${prefix}001`;
    }

    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10);
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');

    return `${prefix}${nextNumber}`;
  }
}
