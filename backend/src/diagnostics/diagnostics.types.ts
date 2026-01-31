/**
 * AI-assisted diagnostics: read-only, advisory. No auto-actions on financial data.
 */

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

export interface DiagnosticFinding {
  severity: 'info' | 'warning' | 'critical';
  likelyCause: string;
  suggestedAction: string;
  /** Allowed remediation action type, if any (no financial actions). */
  suggestedRemediation?: AllowedRemediationAction;
  params?: Record<string, string>;
}

export interface DiagnosticReport {
  id: string;
  at: string;
  aggregates: DiagnosticsAggregates;
  findings: DiagnosticFinding[];
  summary: string;
}

/** Allowed remediation actions (guarded). Disallowed: payment retries, ledger writes, refunds. */
export enum AllowedRemediationAction {
  RESTART_PROCESS = 'RESTART_PROCESS',
  CLEAR_CIRCUIT_BREAKER = 'CLEAR_CIRCUIT_BREAKER',
  TOGGLE_FEATURE_FLAG = 'TOGGLE_FEATURE_FLAG',
}

export interface ExecuteRemediationDto {
  action: AllowedRemediationAction;
  params?: Record<string, string>;
  /** Explicit approval required; request is rejected if not true. */
  approved: boolean;
}

export interface RemediationAuditPayload {
  action: string;
  params: Record<string, unknown>;
  actor: string;
  approved: boolean;
  result: 'success' | 'failure';
  error?: string;
  at: string;
}
