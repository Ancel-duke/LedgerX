import { apiClient } from './api-client';
import type { Organization } from '@/types';

export interface CreateOrganizationDto {
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  logoUrl?: string;
  isActive?: boolean;
}

export interface UpdateOrganizationDto {
  name?: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  taxId?: string;
  logoUrl?: string;
  isActive?: boolean;
}

class OrganizationsService {
  async getAll(params?: { page?: number; limit?: number }) {
    const response = await apiClient.get('/organizations', { params });
    return response.data.data;
  }

  async getById(id: string): Promise<Organization> {
    const response = await apiClient.get(`/organizations/${id}`);
    return response.data.data;
  }

  async create(data: CreateOrganizationDto): Promise<Organization> {
    const response = await apiClient.post('/organizations', data);
    return response.data.data;
  }

  async update(id: string, data: UpdateOrganizationDto): Promise<Organization> {
    const response = await apiClient.patch(`/organizations/${id}`, data);
    return response.data.data;
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/organizations/${id}`);
  }
}

export const organizationsService = new OrganizationsService();
