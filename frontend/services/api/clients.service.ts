import { apiClient } from './api-client';
import type { Client, CreateClientDto, UpdateClientDto } from '@/types';

class ClientsService {
  async getAll(params?: { page?: number; limit?: number }) {
    const response = await apiClient.get('/clients', { params });
    return response.data.data;
  }

  async getById(id: string): Promise<Client> {
    const response = await apiClient.get(`/clients/${id}`);
    return response.data.data;
  }

  async create(data: CreateClientDto): Promise<Client> {
    const response = await apiClient.post('/clients', data);
    return response.data.data;
  }

  async update(id: string, data: UpdateClientDto): Promise<Client> {
    const response = await apiClient.patch(`/clients/${id}`, data);
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/clients/${id}`);
  }
}

export const clientsService = new ClientsService();
