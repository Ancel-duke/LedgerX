import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';
import type { User, Organization, LoginResponse, RegisterResponse } from '@/types';

export interface MeResponse {
  user: User;
  organization: Organization;
  organizations: Array<{ id: string; name: string; slug: string }>;
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post('/auth/login', { email, password });
    return unwrapResponse(response.data);
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }): Promise<RegisterResponse> {
    const response = await apiClient.post('/auth/register', data);
    return unwrapResponse(response.data);
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }> {
    const response = await apiClient.post('/auth/refresh', { refreshToken });
    return unwrapResponse(response.data);
  }

  async getMe(): Promise<MeResponse> {
    const response = await apiClient.get('/auth/me');
    return unwrapResponse(response.data);
  }

  async switchOrganization(organizationId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const response = await apiClient.post('/auth/switch-organization', { organizationId });
    return unwrapResponse(response.data);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
    const body = unwrapResponse<{ message?: string } | undefined>(response.data);
    return body && typeof body === 'object' && 'message' in body ? { message: (body as { message: string }).message } : { message: 'If an account exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    const body = unwrapResponse<{ message?: string } | undefined>(response.data);
    return body && typeof body === 'object' && 'message' in body ? { message: (body as { message: string }).message } : { message: 'Password has been reset.' };
  }
}

export const authService = new AuthService();
