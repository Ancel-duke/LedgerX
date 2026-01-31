import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';
import type { Client, CreateClientDto, UpdateClientDto } from '@/types';

class ClientsService {
  async getAll(params?: { page?: number; limit?: number }) {
    const response = await apiClient.get('/clients', { params });
    return unwrapResponse(response.data);
  }

  async getById(id: string): Promise<Client> {
    const response = await apiClient.get(`/clients/${id}`);
    return unwrapResponse(response.data);
  }

  async create(data: CreateClientDto): Promise<Client> {
    const response = await apiClient.post('/clients', data);
    return unwrapResponse(response.data);
  }

  async update(id: string, data: UpdateClientDto): Promise<Client> {
    const response = await apiClient.patch(`/clients/${id}`, data);
    return unwrapResponse(response.data);
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/clients/${id}`);
  }
}

export const clientsService = new ClientsService();
