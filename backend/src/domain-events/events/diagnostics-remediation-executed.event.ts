/** Emitted when a diagnostics remediation action is executed (after approval). Fully audited. */
export const DIAGNOSTICS_REMEDIATION_EXECUTED = 'diagnostics.remediation.executed';

export interface DiagnosticsRemediationExecutedPayload {
  action: string;
  params: Record<string, unknown>;
  actor: string;
  approved: boolean;
  result: 'success' | 'failure';
  error?: string;
  at: string;
}
