import { apiClient } from './api-client';
import { unwrapResponse, asArray } from '@/lib/api-response';

export interface DiagnosticsAggregates {
  metrics: {
    authFailuresTotal: number;
    paymentFailuresTotal: number;
    circuitOpenTotal: number;
    rateLimitExceededTotal: number;
  };
  circuits: Array<{ key: string; state: string; failures: number }>;
  at: string;
}

export interface DiagnosticReport {
  id: string;
  at: string;
  aggregates: DiagnosticsAggregates;
  findings: Array<{ severity: string; likelyCause: string; suggestedAction: string }>;
  summary: string;
  aiSummary?: string | null;
}

export interface JobRunRecord {
  name: string;
  lastRunAt: string | null;
  lastStatus: string;
  cronExpression?: string;
}

class DiagnosticsService {
  async getAggregates(): Promise<DiagnosticsAggregates> {
    const res = await apiClient.get('/diagnostics/aggregates');
    return unwrapResponse(res.data) ?? ({} as DiagnosticsAggregates);
  }

  async getReport(): Promise<DiagnosticReport | { message: string }> {
    const res = await apiClient.get('/diagnostics/report');
    return unwrapResponse(res.data);
  }

  async getReportHistory(limit = 50): Promise<DiagnosticReport[]> {
    const res = await apiClient.get('/diagnostics/report/history', { params: { limit } });
    return asArray<DiagnosticReport>(unwrapResponse(res.data));
  }

  async getReportCompare(): Promise<{ current: DiagnosticReport; previous: DiagnosticReport | null } | { message: string }> {
    const res = await apiClient.get('/diagnostics/report/compare');
    return unwrapResponse(res.data);
  }

  async generateReport(): Promise<DiagnosticReport> {
    const res = await apiClient.post('/diagnostics/report/generate');
    return unwrapResponse(res.data);
  }

  async getFeatureFlags(orgId?: string, environment?: string): Promise<Record<string, boolean>> {
    const res = await apiClient.get('/diagnostics/feature-flags', {
      params: orgId ? { orgId } : environment ? { environment } : {},
    });
    const out = unwrapResponse<Record<string, boolean> | undefined>(res.data);
    return out && typeof out === 'object' ? out : {};
  }

  async getFeatureFlagRows(): Promise<Array<{ key: string; scope: string; scopeId: string | null; value: boolean }>> {
    const res = await apiClient.get('/diagnostics/feature-flags/rows');
    return asArray(unwrapResponse(res.data));
  }

  async getJobs(): Promise<JobRunRecord[]> {
    const res = await apiClient.get('/diagnostics/jobs');
    return asArray<JobRunRecord>(unwrapResponse(res.data));
  }
}

export const diagnosticsService = new DiagnosticsService();
