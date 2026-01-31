import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram } from 'prom-client';

const HTTP_REQUEST_DURATION = 'http_request_duration_seconds';
const AUTH_FAILURES_TOTAL = 'auth_failures_total';
const PAYMENT_FAILURES_TOTAL = 'payment_failures_total';
const CIRCUIT_OPEN_TOTAL = 'circuit_open_total';
const CIRCUIT_HALF_OPEN_ATTEMPTS_TOTAL = 'circuit_half_open_attempts_total';
const RATE_LIMIT_EXCEEDED_TOTAL = 'rate_limit_exceeded_total';

@Injectable()
export class MetricsService {
  readonly register: Registry;
  private readonly requestDuration: Histogram<string>;
  private readonly authFailures: Counter<string>;
  private readonly paymentFailures: Counter<string>;
  private readonly circuitOpenTotal: Counter<string>;
  private readonly circuitHalfOpenAttemptsTotal: Counter<string>;
  private readonly rateLimitExceededTotal: Counter<string>;

  constructor() {
    this.register = new Registry();
    this.requestDuration = new Histogram({
      name: HTTP_REQUEST_DURATION,
      help: 'HTTP request latency in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.register],
    });
    this.authFailures = new Counter({
      name: AUTH_FAILURES_TOTAL,
      help: 'Total number of authentication failures',
      labelNames: ['reason'],
      registers: [this.register],
    });
    this.paymentFailures = new Counter({
      name: PAYMENT_FAILURES_TOTAL,
      help: 'Total number of payment failures (no auto-retry)',
      labelNames: ['context'],
      registers: [this.register],
    });
    this.circuitOpenTotal = new Counter({
      name: CIRCUIT_OPEN_TOTAL,
      help: 'Total number of times the circuit transitioned to open',
      labelNames: ['provider'],
      registers: [this.register],
    });
    this.circuitHalfOpenAttemptsTotal = new Counter({
      name: CIRCUIT_HALF_OPEN_ATTEMPTS_TOTAL,
      help: 'Total number of attempts made while circuit was half-open',
      labelNames: ['provider'],
      registers: [this.register],
    });
    this.rateLimitExceededTotal = new Counter({
      name: RATE_LIMIT_EXCEEDED_TOTAL,
      help: 'Total number of requests rejected due to rate limit',
      labelNames: ['scope'],
      registers: [this.register],
    });
  }

  recordRequestDuration(method: string, path: string, statusCode: number, durationSeconds: number): void {
    const pathNorm = this.normalizePath(path);
    this.requestDuration.observe(
      { method, path: pathNorm, status: String(statusCode) },
      durationSeconds,
    );
  }

  recordAuthFailure(reason = 'unauthorized'): void {
    this.authFailures.inc({ reason });
  }

  recordPaymentFailure(context = 'payment'): void {
    this.paymentFailures.inc({ context });
  }

  recordCircuitOpen(provider: string): void {
    this.circuitOpenTotal.inc({ provider });
  }

  recordCircuitHalfOpenAttempt(provider: string): void {
    this.circuitHalfOpenAttemptsTotal.inc({ provider });
  }

  recordRateLimitExceeded(scope: 'ip' | 'org'): void {
    this.rateLimitExceededTotal.inc({ scope });
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Snapshot of counter values for diagnostics (read-only).
   * Safely handles different prom-client JSON shapes and missing/nested values; never throws.
   */
  async getDiagnosticsSnapshot(): Promise<{
    authFailuresTotal: number;
    paymentFailuresTotal: number;
    circuitOpenTotal: number;
    rateLimitExceededTotal: number;
  }> {
    const safe: { authFailuresTotal: number; paymentFailuresTotal: number; circuitOpenTotal: number; rateLimitExceededTotal: number } = {
      authFailuresTotal: 0,
      paymentFailuresTotal: 0,
      circuitOpenTotal: 0,
      rateLimitExceededTotal: 0,
    };
    try {
      const raw = await this.register.getMetricsAsJSON();
      const metrics = Array.isArray(raw) ? raw : [];
      const sum = (name: string): number => {
        const m = metrics.find((x: unknown) => typeof x === 'object' && x !== null && (x as { name?: string }).name === name);
        if (!m || typeof m !== 'object') return 0;
        const obj = m as unknown as Record<string, unknown>;
        if (!('values' in obj)) return 0;
        const values = obj.values;
        if (!Array.isArray(values)) return 0;
        return values.reduce((s: number, v: unknown) => {
          if (typeof v === 'object' && v !== null && 'value' in (v as object)) {
            const val = (v as { value: unknown }).value;
            return s + (typeof val === 'number' ? val : 0);
          }
          return s;
        }, 0);
      };
      safe.authFailuresTotal = sum(AUTH_FAILURES_TOTAL);
      safe.paymentFailuresTotal = sum(PAYMENT_FAILURES_TOTAL);
      safe.circuitOpenTotal = sum(CIRCUIT_OPEN_TOTAL);
      safe.rateLimitExceededTotal = sum(RATE_LIMIT_EXCEEDED_TOTAL);
    } catch {
      // Diagnostics must not crash the process; return zeros on any error
    }
    return safe;
  }

  private normalizePath(path: string): string {
    if (!path) return '/';
    const base = path.split('?')[0];
    const parts = base.split('/').filter(Boolean);
    const normalized = parts
      .map((p) => (/^[0-9a-f-]{36}$/i.test(p) || /^\d+$/.test(p) ? ':id' : p))
      .join('/');
    return '/' + (normalized || '');
  }
}
