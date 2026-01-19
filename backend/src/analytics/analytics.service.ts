import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(organizationId: string, query: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(query);
    const paymentDateFilter = this.buildPaymentDateFilter(query);

    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      deletedAt: null, // Only count non-deleted invoices
      ...dateFilter,
    };

    // Build payment filter - only count COMPLETED payments with processedAt
    const paymentWhere: Prisma.PaymentWhereInput = {
      organizationId,
      status: 'COMPLETED',
      deletedAt: null,
      processedAt: { not: null }, // Only count payments that have been processed
      ...paymentDateFilter,
    };

    const [
      totalInvoices,
      totalRevenue,
      pendingInvoices,
      overdueInvoices,
      recentInvoices,
      recentPayments,
    ] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.payment.aggregate({
        where: paymentWhere,
        _sum: {
          amount: true,
        },
      }),
      this.prisma.invoice.count({
        where: {
          ...where,
          status: 'SENT',
        },
      }),
      this.prisma.invoice.count({
        where: {
          ...where,
          status: 'OVERDUE',
        },
      }),
      this.prisma.invoice.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          status: true,
          dueDate: true,
          createdAt: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          method: true,
          processedAt: true,
          createdAt: true,
          invoice: {
            select: {
              invoiceNumber: true,
            },
          },
        },
      }),
    ]);

    return {
      totalInvoices,
      totalRevenue: totalRevenue._sum.amount ? Number(totalRevenue._sum.amount) : 0,
      pendingInvoices,
      overdueInvoices,
      recentInvoices,
      recentPayments,
    };
  }

  async getRevenueByPeriod(organizationId: string, query: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(query);
    const paymentDateFilter = this.buildPaymentDateFilter(query);
    const period = query.period || 'month';

    const paymentWhere: Prisma.PaymentWhereInput = {
      organizationId,
      status: 'COMPLETED',
      deletedAt: null,
      processedAt: { not: null }, // Only include payments with processedAt
      ...paymentDateFilter,
    };

    const payments = await this.prisma.payment.findMany({
      where: paymentWhere,
      select: {
        amount: true,
        processedAt: true,
      },
    });

    const grouped = this.groupByPeriod(payments, period);

    return grouped;
  }

  async getInvoiceStatusDistribution(organizationId: string, query: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(query);

    const invoices = await this.prisma.invoice.groupBy({
      by: ['status'],
      where: {
        organizationId,
        deletedAt: null, // Only count non-deleted invoices
        ...dateFilter,
      },
      _count: {
        id: true,
      },
    });

    return invoices.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));
  }

  async getPaymentMethodDistribution(organizationId: string, query: AnalyticsQueryDto) {
    const dateFilter = this.buildDateFilter(query);
    const paymentDateFilter = this.buildPaymentDateFilter(query);

    const paymentWhere: Prisma.PaymentWhereInput = {
      organizationId,
      status: 'COMPLETED',
      deletedAt: null,
      processedAt: { not: null }, // Only include payments with processedAt
      ...paymentDateFilter,
    };

    const payments = await this.prisma.payment.groupBy({
      by: ['method'],
      where: paymentWhere,
      _sum: {
        amount: true,
      },
    });

    return payments.map((item) => ({
      method: item.method,
      total: item._sum?.amount ? Number(item._sum.amount) : 0,
    }));
  }

  private buildDateFilter(query: AnalyticsQueryDto): Prisma.InvoiceWhereInput {
    if (!query.startDate && !query.endDate) {
      return {};
    }

    return {
      createdAt: {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      },
    };
  }

  private buildPaymentDateFilter(query: AnalyticsQueryDto): Prisma.PaymentWhereInput {
    if (!query.startDate && !query.endDate) {
      return {}; // No date filter - return all payments
    }

    const filter: any = {};
    
    if (query.startDate || query.endDate) {
      filter.processedAt = {};
      if (query.startDate) {
        filter.processedAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.processedAt.lte = new Date(query.endDate);
      }
    }

    return filter;
  }

  private groupByPeriod(
    payments: Array<{ amount: any; processedAt: Date | null }>,
    period: string,
  ) {
    const grouped: Record<string, number> = {};

    payments.forEach((payment) => {
      if (!payment.processedAt) return;

      const date = new Date(payment.processedAt);
      let key: string;

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0];
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      grouped[key] = (grouped[key] || 0) + Number(payment.amount);
    });

    return Object.entries(grouped).map(([period, revenue]) => ({
      period,
      revenue,
    }));
  }
}
