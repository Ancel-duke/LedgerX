import { apiClient } from './api-client';
import type { User, LoginResponse, RegisterResponse } from '@/types';

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data.data;
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }): Promise<RegisterResponse> {
    const response = await apiClient.post('/auth/register', data);
    return response.data.data;
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return response.data.data;
  }

  async getCurrentUser(token?: string): Promise<User> {
    // Since backend doesn't have /auth/me, we'll decode the token or use a different approach
    // For now, we'll return null and let the auth provider handle it
    // In production, you'd decode the JWT token or add a /auth/me endpoint
    throw new Error('getCurrentUser not implemented - decode JWT token instead');
  }
}

export const authService = new AuthService();
