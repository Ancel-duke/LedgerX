import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';
import type { User } from '@/types';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  isActive?: boolean;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'ADMIN' | 'MANAGER' | 'STAFF';
  isActive?: boolean;
}

class UsersService {
  async getAll(params?: { page?: number; limit?: number }) {
    const response = await apiClient.get('/users', { params });
    return unwrapResponse(response.data);
  }

  async getById(id: string): Promise<User> {
    const response = await apiClient.get(`/users/${id}`);
    return unwrapResponse(response.data);
  }

  async create(data: CreateUserDto): Promise<User> {
    const response = await apiClient.post('/users', data);
    return unwrapResponse(response.data);
  }

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const response = await apiClient.patch(`/users/${id}`, data);
    return unwrapResponse(response.data);
  }

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  }
}

export const usersService = new UsersService();
