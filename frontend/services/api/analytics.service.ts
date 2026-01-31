import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';

export interface DashboardStats {
  totalInvoices: number;
  totalRevenue: number;
  pendingInvoices: number;
  overdueInvoices: number;
  recentInvoices?: unknown[];
  recentPayments?: unknown[];
}

class AnalyticsService {
  async getDashboardStats(params?: { startDate?: string; endDate?: string; period?: string }): Promise<DashboardStats> {
    const response = await apiClient.get('/analytics/dashboard', { params });
    const raw = unwrapResponse<DashboardStats>(response.data);
    return raw ?? { totalInvoices: 0, totalRevenue: 0, pendingInvoices: 0, overdueInvoices: 0 };
  }

  async getRevenueByPeriod(params?: { startDate?: string; endDate?: string; period?: string }) {
    const response = await apiClient.get('/analytics/revenue', { params });
    return unwrapResponse(response.data);
  }

  async getInvoiceStatusDistribution(params?: { startDate?: string; endDate?: string }) {
    const response = await apiClient.get('/analytics/invoice-status', { params });
    return unwrapResponse(response.data);
  }

  async getPaymentMethodDistribution(params?: { startDate?: string; endDate?: string }) {
    const response = await apiClient.get('/analytics/payment-methods', { params });
    return unwrapResponse(response.data);
  }
}

export const analyticsService = new AnalyticsService();
