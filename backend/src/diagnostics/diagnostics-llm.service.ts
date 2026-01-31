import { Injectable } from '@nestjs/common';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { DiagnosticReport, DiagnosticsAggregates } from './diagnostics.types';

/**
 * Optional LLM integration for diagnostics: advisory only.
 * Input: metrics snapshot + rule findings. Output: human-readable cause + suggested action.
 * Guardrails: AI cannot trigger payments, ledger writes, refunds, or retries. Feature-flag off by default.
 */
@Injectable()
export class DiagnosticsLlmService {
  private readonly logger = new StructuredLoggerService(DiagnosticsLlmService.name);
  private readonly enabled: boolean;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor() {
    this.enabled = process.env.DIAGNOSTICS_AI_ENABLED === 'true';
    this.apiKey = process.env.OPENAI_API_KEY ?? '';
    const t = process.env.DIAGNOSTICS_LLM_TIMEOUT_MS;
    this.timeoutMs = t ? parseInt(t, 10) : 10_000;
  }

  isEnabled(): boolean {
    return this.enabled && !!this.apiKey;
  }

  /**
   * Request a human-readable summary from LLM (advisory only). Never acts on money flows.
   * Returns null if disabled, misconfigured, or on any error (diagnostics must not crash).
   */
  async getAdvisorySummary(report: DiagnosticReport): Promise<string | null> {
    if (!this.isEnabled()) return null;
    try {
      const text = await this.callOpenAi(report);
      return text ?? null;
    } catch (err) {
      this.logger.warn('Diagnostics LLM call failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  private async callOpenAi(report: DiagnosticReport): Promise<string | null> {
    const payload = this.buildPayload(report);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.DIAGNOSTICS_LLM_MODEL ?? 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a read-only DevOps advisor. Summarize the provided diagnostic snapshot and rule-based findings in 2-4 short sentences. Suggest only non-financial actions (e.g. check logs, clear circuit breaker, restart process). Never suggest payment retries, ledger writes, or refunds. Output plain text only.',
            },
            {
              role: 'user',
              content: payload,
            },
          ],
          max_tokens: 300,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn('OpenAI API error', { status: res.status, body: errText.slice(0, 200) });
        return null;
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data?.choices?.[0]?.message?.content?.trim();
      return content ?? null;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.warn('Diagnostics LLM request timed out');
        return null;
      }
      throw err;
    }
  }

  private buildPayload(report: DiagnosticReport): string {
    const a = report.aggregates;
    const metrics = a?.metrics ?? {};
    const circuits = a?.circuits ?? [];
    const findings = report.findings ?? [];
    return [
      'Metrics snapshot:',
      JSON.stringify({
        authFailuresTotal: metrics.authFailuresTotal,
        paymentFailuresTotal: metrics.paymentFailuresTotal,
        circuitOpenTotal: metrics.circuitOpenTotal,
        rateLimitExceededTotal: metrics.rateLimitExceededTotal,
        circuits: circuits.map((c) => ({ key: c.key, state: c.state, failures: c.failures })),
      }),
      'Rule-based findings:',
      JSON.stringify(findings.map((f) => ({ severity: f.severity, likelyCause: f.likelyCause, suggestedAction: f.suggestedAction }))),
      'Current summary:',
      report.summary,
    ].join('\n');
  }
}
