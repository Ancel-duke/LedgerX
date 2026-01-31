import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';

class AnalyticsService {
  async getDashboardStats(params?: { startDate?: string; endDate?: string; period?: string }) {
    const response = await apiClient.get('/analytics/dashboard', { params });
    return unwrapResponse(response.data);
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
