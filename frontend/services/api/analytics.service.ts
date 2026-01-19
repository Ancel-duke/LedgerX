import { apiClient } from './api-client';

class AnalyticsService {
  async getDashboardStats(params?: { startDate?: string; endDate?: string; period?: string }) {
    const response = await apiClient.get('/analytics/dashboard', { params });
    return response.data.data;
  }

  async getRevenueByPeriod(params?: { startDate?: string; endDate?: string; period?: string }) {
    const response = await apiClient.get('/analytics/revenue', { params });
    return response.data.data;
  }

  async getInvoiceStatusDistribution(params?: { startDate?: string; endDate?: string }) {
    const response = await apiClient.get('/analytics/invoice-status', { params });
    return response.data.data;
  }

  async getPaymentMethodDistribution(params?: { startDate?: string; endDate?: string }) {
    const response = await apiClient.get('/analytics/payment-methods', { params });
    return response.data.data;
  }
}

export const analyticsService = new AnalyticsService();
