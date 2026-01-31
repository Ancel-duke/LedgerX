import { apiClient } from './api-client';
import { unwrapListResponse } from '@/lib/api-response';

export interface AuditRecord {
  id: string;
  organizationId: string;
  eventType: string;
  actor: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  payloadHash?: string;
  previousHash?: string;
  currentHash?: string;
}

class AuditComplianceService {
  async getEntityAuditHistory(
    entityType: string,
    entityId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: AuditRecord[]; total?: number }> {
    const res = await apiClient.get(
      `/audit-compliance/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`,
      { params: { page, limit } },
    );
    const { data, meta } = unwrapListResponse<AuditRecord, { total?: number }>(res.data);
    return { data, total: meta?.total };
  }

  async getTimeRangeExport(
    from: string,
    to: string,
    page = 1,
    limit = 100,
  ): Promise<{ data: AuditRecord[]; total?: number }> {
    const res = await apiClient.get('/audit-compliance/export', {
      params: { from, to, page, limit },
    });
    const { data, meta } = unwrapListResponse<AuditRecord, { total?: number }>(res.data);
    return { data, total: meta?.total };
  }
}

export const auditComplianceService = new AuditComplianceService();
