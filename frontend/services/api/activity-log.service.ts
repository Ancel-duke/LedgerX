import { apiClient } from './api-client';
import { unwrapResponse } from '@/lib/api-response';
import type { ActivityLog } from '@/types';

export interface ActivityLogListResponse {
  data: ActivityLog[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

class ActivityLogService {
  async getAll(params?: {
    page?: number;
    limit?: number;
    entityType?: string;
    userId?: string;
  }): Promise<ActivityLogListResponse> {
    const response = await apiClient.get('/activity-log', { params });
    return unwrapResponse<ActivityLogListResponse>(response.data) ?? { data: [] };
  }

  async getByEntity(entityType: string, entityId: string, params?: { page?: number; limit?: number }) {
    const response = await apiClient.get(`/activity-log/entity/${entityType}/${entityId}`, { params });
    return unwrapResponse(response.data);
  }

  async create(data: {
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const response = await apiClient.post('/activity-log', data);
    return unwrapResponse(response.data);
  }
}

export const activityLogService = new ActivityLogService();
