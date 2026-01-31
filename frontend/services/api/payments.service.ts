import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';
import type { Payment, CreatePaymentDto, UpdatePaymentDto } from '@/types';

class PaymentsService {
  async getAll(params?: { page?: number; limit?: number; status?: string; invoiceId?: string }) {
    const response = await apiClient.get('/payments', { params });
    return unwrapResponse(response.data);
  }

  async getById(id: string): Promise<Payment> {
    const response = await apiClient.get(`/payments/${id}`);
    return unwrapResponse(response.data);
  }

  async create(data: CreatePaymentDto): Promise<Payment> {
    const response = await apiClient.post('/payments', data);
    return unwrapResponse(response.data);
  }

  async update(id: string, data: UpdatePaymentDto): Promise<Payment> {
    const response = await apiClient.patch(`/payments/${id}`, data);
    return unwrapResponse(response.data);
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/payments/${id}`);
  }
}

export const paymentsService = new PaymentsService();
