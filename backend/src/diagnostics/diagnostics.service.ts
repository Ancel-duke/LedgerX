import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { MetricsService } from '../metrics/metrics.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import {
  DiagnosticsAggregates,
  DiagnosticReport,
  DiagnosticFinding,
  AllowedRemediationAction,
} from './diagnostics.types';

/**
 * AI-assisted diagnostics: read-only, advisory. Aggregates metrics and circuit state,
 * produces a rule-based diagnostic report (likely cause, suggested action). Logged only; no auto-action.
 * AI must NOT retry payments, post ledger, or reverse transactions.
 */
@Injectable()
export class DiagnosticsService {
  private readonly logger = new StructuredLoggerService(DiagnosticsService.name);
  private lastReport: DiagnosticReport | null = null;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /** Current aggregates (error rates, circuit states, auth/payment failures). */
  async getAggregates(): Promise<DiagnosticsAggregates> {
    const [metrics, circuits] = await Promise.all([
      this.metricsService.getDiagnosticsSnapshot(),
      Promise.resolve(this.circuitBreakerService.listCircuits()),
    ]);
    return {
      metrics,
      circuits: circuits.map((c) => ({
        key: c.key,
        state: c.state,
        failures: c.failures,
      })),
      at: new Date().toISOString(),
    };
  }

  /** Generate diagnostic report with rule-based likely cause and suggested action (advisory only). */
  async generateDiagnosticReport(): Promise<DiagnosticReport> {
    const aggregates = await this.getAggregates();
    const findings: DiagnosticFinding[] = [];

    if (aggregates.metrics.authFailuresTotal > 10) {
      findings.push({
        severity: 'warning',
        likelyCause: 'Elevated auth failures; possible invalid credentials or misconfigured JWT.',
        suggestedAction: 'Check JWT secrets and token expiry; verify client credentials.',
      });
    }

    if (aggregates.metrics.paymentFailuresTotal > 5) {
      findings.push({
        severity: 'warning',
        likelyCause: 'Payment failures; possible provider outage or config issue.',
        suggestedAction: 'Check provider status and API keys; wait before retrying. Do not auto-retry payments.',
      });
    }

    const openCircuits = aggregates.circuits.filter((c) => c.state === 'open');
    if (openCircuits.length > 0) {
      findings.push({
        severity: 'critical',
        likelyCause: `Provider outage or unreachable: circuit(s) open for ${openCircuits.map((c) => c.key).join(', ')}.`,
        suggestedAction: 'Wait for circuit to half-open, or clear circuit after verifying provider is back (requires approval).',
        suggestedRemediation: AllowedRemediationAction.CLEAR_CIRCUIT_BREAKER,
        params: { key: openCircuits[0].key },
      });
    }

    if (aggregates.metrics.rateLimitExceededTotal > 20) {
      findings.push({
        severity: 'info',
        likelyCause: 'Rate limit exceeded frequently; possible abuse or legitimate burst.',
        suggestedAction: 'Review rate limits; consider adjusting thresholds or blocking abusive IPs.',
      });
    }

    if (findings.length === 0) {
      findings.push({
        severity: 'info',
        likelyCause: 'No significant anomalies detected.',
        suggestedAction: 'No action required.',
      });
    }

    const summary =
      findings.length === 1 && findings[0].severity === 'info'
        ? 'Healthy'
        : `${findings.length} finding(s): ${findings.map((f) => f.likelyCause).join('; ')}`;

    const report: DiagnosticReport = {
      id: randomUUID(),
      at: new Date().toISOString(),
      aggregates,
      findings,
      summary,
    };

    this.lastReport = report;
    return report;
  }

  getLastReport(): DiagnosticReport | null {
    return this.lastReport;
  }

  /** Periodic diagnostic run: generate report and log (no auto-action). */
  @Cron(process.env.DIAGNOSTICS_CRON ?? '*/15 * * * *', { name: 'diagnosticsReport' })
  async runScheduledDiagnostics(): Promise<void> {
    try {
      const report = await this.generateDiagnosticReport();
      this.logger.log('Diagnostic report generated', {
        reportId: report.id,
        findingCount: report.findings.length,
        summary: report.summary,
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Diagnostic report failed', undefined, e);
    }
  }
}
