import { apiClient } from './api-client';
import { unwrapResponse, unwrapListResponse } from '@/lib/api-response';

export interface RiskScoreResult {
  paymentId: string;
  riskScore: number;
  factors?: Record<string, unknown>;
}

export interface FlaggedItem {
  entityType: string;
  entityId: string;
  riskScore: number;
  isFlagged: boolean;
  createdAt?: string;
}

export interface BlockCheckResult {
  block: boolean;
  reason?: string;
}

class FraudDetectionService {
  async getRiskScore(paymentId: string): Promise<RiskScoreResult> {
    const res = await apiClient.get(`/fraud-detection/risk-score/${paymentId}`);
    return unwrapResponse(res.data);
  }

  async listFlagged(params?: {
    page?: number;
    limit?: number;
    entityType?: 'PAYMENT' | 'LEDGER_TRANSACTION';
  }): Promise<{ data: FlaggedItem[]; total?: number }> {
    const res = await apiClient.get('/fraud-detection/flagged', { params });
    const { data, meta } = unwrapListResponse<FlaggedItem, { total?: number }>(res.data);
    return { data, total: meta?.total };
  }

  async blockCheck(paymentId: string): Promise<BlockCheckResult> {
    const res = await apiClient.get(`/fraud-detection/policy/block-check/${paymentId}`);
    return unwrapResponse(res.data);
  }

  async orgBlockCheck(params?: { windowHours?: number; maxFlagged?: number }): Promise<BlockCheckResult> {
    const res = await apiClient.get('/fraud-detection/policy/org-block-check', { params });
    return unwrapResponse(res.data);
  }
}

export const fraudDetectionService = new FraudDetectionService();
