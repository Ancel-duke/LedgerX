import { apiClient } from './api-client';

class ActivityLogService {
  async getAll(params?: {
    page?: number;
    limit?: number;
    entityType?: string;
    userId?: string;
  }) {
    const response = await apiClient.get('/activity-log', { params });
    return response.data.data;
  }

  async getByEntity(entityType: string, entityId: string, params?: { page?: number; limit?: number }) {
    const response = await apiClient.get(`/activity-log/entity/${entityType}/${entityId}`, { params });
    return response.data.data;
  }

  async create(data: {
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, any>;
  }) {
    const response = await apiClient.post('/activity-log', data);
    return response.data.data;
  }
}

export const activityLogService = new ActivityLogService();
