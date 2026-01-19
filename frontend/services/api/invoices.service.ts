import { apiClient } from './api-client';
import type { Invoice, CreateInvoiceDto, UpdateInvoiceDto } from '@/types';

class InvoicesService {
  async getAll(params?: { page?: number; limit?: number; status?: string }) {
    const response = await apiClient.get('/invoices', { params });
    return response.data.data;
  }

  async getById(id: string) {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data.data;
  }

  async create(data: CreateInvoiceDto): Promise<Invoice> {
    const response = await apiClient.post('/invoices', data);
    return response.data.data;
  }

  async update(id: string, data: UpdateInvoiceDto): Promise<Invoice> {
    const response = await apiClient.patch(`/invoices/${id}`, data);
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/invoices/${id}`);
  }
}

export const invoicesService = new InvoicesService();
