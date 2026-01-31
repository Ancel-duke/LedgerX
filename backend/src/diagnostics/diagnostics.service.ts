import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { MetricsService } from '../metrics/metrics.service';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { PrismaService } from '../database/postgres/prisma.service';
import { ScheduledJobsRegistryService } from '../common/scheduled-jobs/scheduled-jobs-registry.service';
import { DiagnosticsLlmService } from './diagnostics-llm.service';
import {
  DiagnosticsAggregates,
  DiagnosticReport,
  DiagnosticFinding,
  AllowedRemediationAction,
} from './diagnostics.types';

const DEFAULT_RETENTION_DAYS = 30;

/**
 * AI-assisted diagnostics: read-only, advisory. Aggregates metrics and circuit state,
 * produces a rule-based diagnostic report (likely cause, suggested action). Logged only; no auto-action.
 * AI must NOT retry payments, post ledger, or reverse transactions.
 */
@Injectable()
export class DiagnosticsService {
  private readonly logger = new StructuredLoggerService(DiagnosticsService.name);
  private lastReport: DiagnosticReport | null = null;
  private readonly retentionDays: number;

  private static readonly JOB_NAME = 'diagnosticsReport';

  constructor(
    private readonly metricsService: MetricsService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly prisma: PrismaService,
    private readonly diagnosticsLlm: DiagnosticsLlmService,
    private readonly jobsRegistry: ScheduledJobsRegistryService,
  ) {
    const env = process.env.DIAGNOSTICS_RETENTION_DAYS;
    this.retentionDays = env ? parseInt(env, 10) : DEFAULT_RETENTION_DAYS;
  }

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

    let aiSummary: string | null = null;
    if (this.diagnosticsLlm.isEnabled()) {
      const reportSoFar: DiagnosticReport = { id: randomUUID(), at: new Date().toISOString(), aggregates, findings, summary };
      aiSummary = await this.diagnosticsLlm.getAdvisorySummary(reportSoFar);
    }

    const report: DiagnosticReport = {
      id: randomUUID(),
      at: new Date().toISOString(),
      aggregates,
      findings,
      summary,
      aiSummary: aiSummary ?? undefined,
    };

    this.lastReport = report;
    try {
      await this.prisma.diagnosticReportHistory.create({
        data: {
          id: report.id,
          reportAt: new Date(report.at),
          aggregates: report.aggregates as object,
          findings: report.findings as object,
          summary: report.summary,
          aiSummary: report.aiSummary ?? null,
        },
      });
    } catch (err) {
      this.logger.warn('Failed to persist diagnostic report (non-fatal)', { reportId: report.id });
    }
    await this.cleanupOldReports();
    return report;
  }

  /** Last report from memory or latest from DB. */
  async getLastReport(): Promise<DiagnosticReport | null> {
    if (this.lastReport) return this.lastReport;
    try {
      const row = await this.prisma.diagnosticReportHistory.findFirst({
        orderBy: { reportAt: 'desc' },
      });
      return row ? this.rowToReport(row) : null;
    } catch {
      return null;
    }
  }

  /** Persisted report history (newest first). */
  async getReportHistory(limit = 50): Promise<DiagnosticReport[]> {
    try {
      const rows = await this.prisma.diagnosticReportHistory.findMany({
        orderBy: { reportAt: 'desc' },
        take: Math.min(limit, 100),
      });
      return rows.map((row) => this.rowToReport(row));
    } catch {
      return [];
    }
  }

  /** Compare current snapshot vs previous report (for "compare now vs previous"). */
  async getCompare(): Promise<{ current: DiagnosticReport; previous: DiagnosticReport | null } | null> {
    const current = await this.generateDiagnosticReport();
    try {
      const previousRows = await this.prisma.diagnosticReportHistory.findMany({
        orderBy: { reportAt: 'desc' },
        take: 2,
      });
      const previous = previousRows.length >= 2 ? this.rowToReport(previousRows[1]) : null;
      return { current, previous };
    } catch {
      return { current, previous: null };
    }
  }

  private rowToReport(row: { id: string; reportAt: Date; aggregates: unknown; findings: unknown; summary: string; aiSummary: string | null }): DiagnosticReport {
    return {
      id: row.id,
      at: row.reportAt.toISOString(),
      aggregates: row.aggregates as DiagnosticsAggregates,
      findings: row.findings as DiagnosticFinding[],
      summary: row.summary,
      aiSummary: row.aiSummary ?? undefined,
    };
  }

  private async cleanupOldReports(): Promise<void> {
    if (this.retentionDays < 1) return;
    try {
      const before = new Date();
      before.setDate(before.getDate() - this.retentionDays);
      const result = await this.prisma.diagnosticReportHistory.deleteMany({
        where: { reportAt: { lt: before } },
      });
      if (result.count > 0) {
        this.logger.log('Diagnostic report history cleanup', { deleted: result.count, olderThan: before.toISOString() });
      }
    } catch (err) {
      this.logger.warn('Diagnostic report cleanup failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  /** Periodic diagnostic run: generate report and log (no auto-action). */
  @Cron(process.env.DIAGNOSTICS_CRON ?? '*/15 * * * *', { name: DiagnosticsService.JOB_NAME })
  async runScheduledDiagnostics(): Promise<void> {
    try {
      this.jobsRegistry.register(DiagnosticsService.JOB_NAME, process.env.DIAGNOSTICS_CRON ?? '*/15 * * * *');
      const report = await this.generateDiagnosticReport();
      this.logger.log('Diagnostic report generated', {
        reportId: report.id,
        findingCount: report.findings.length,
        summary: report.summary,
      });
      this.jobsRegistry.recordRun(DiagnosticsService.JOB_NAME, 'ok');
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Diagnostic report failed', undefined, e);
      this.jobsRegistry.recordRun(DiagnosticsService.JOB_NAME, 'error');
    }
  }
}
