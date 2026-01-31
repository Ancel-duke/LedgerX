import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';
import type { Invoice, CreateInvoiceDto, UpdateInvoiceDto } from '@/types';

export interface InvoiceListResponse {
  data: Invoice[];
  meta?: { page: number; limit: number; total: number; totalPages?: number };
}

class InvoicesService {
  async getAll(params?: { page?: number; limit?: number; status?: string }): Promise<InvoiceListResponse> {
    const response = await apiClient.get('/invoices', { params });
    return unwrapResponse<InvoiceListResponse>(response.data) ?? { data: [] };
  }

  async getById(id: string) {
    const response = await apiClient.get(`/invoices/${id}`);
    return unwrapResponse(response.data);
  }

  async create(data: CreateInvoiceDto): Promise<Invoice> {
    const response = await apiClient.post('/invoices', data);
    return unwrapResponse(response.data);
  }

  async update(id: string, data: UpdateInvoiceDto): Promise<Invoice> {
    const response = await apiClient.patch(`/invoices/${id}`, data);
    return unwrapResponse(response.data);
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/invoices/${id}`);
  }
}

export const invoicesService = new InvoicesService();
