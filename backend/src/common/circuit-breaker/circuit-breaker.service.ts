import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../../metrics/metrics.service';
import { ProviderUnavailableException } from '../exceptions/provider-unavailable.exception';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  /** Failures before opening (default 5). */
  failureThreshold?: number;
  /** Seconds before trying half-open (default 30). */
  resetAfterSeconds?: number;
  /** Name for logging. */
  name?: string;
}

/**
 * In-memory circuit breaker for external providers (e.g. Stripe, M-Pesa).
 * Does not auto-retry failed financial operations; callers decide.
 */
@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  constructor(private readonly metricsService: MetricsService) {}
  private readonly circuits = new Map<
    string,
    {
      state: CircuitState;
      failures: number;
      lastFailureAt: number | null;
      options: Required<CircuitBreakerOptions>;
    }
  >();

  /**
   * Execute a function through the circuit. Throws if circuit is open.
   * On failure, increments failure count; does not retry.
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options: CircuitBreakerOptions = {},
  ): Promise<T> {
    const circuit = this.getOrCreate(key, options);
    this.maybeTransition(key, circuit);

    if (circuit.state === 'open') {
      this.logger.warn(`Circuit open [${key}], rejecting call`);
      throw new ProviderUnavailableException(key);
    }

    if (circuit.state === 'half_open') {
      this.metricsService.recordCircuitHalfOpenAttempt(key);
    }

    try {
      const result = await fn();
      if (circuit.state === 'half_open') {
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.lastFailureAt = null;
        this.logger.log(`Circuit closed [${key}] after successful call`);
      }
      return result;
    } catch (err) {
      circuit.failures += 1;
      circuit.lastFailureAt = Date.now();
      if (circuit.failures >= circuit.options.failureThreshold) {
        circuit.state = 'open';
        this.metricsService.recordCircuitOpen(key);
        this.logger.warn(
          `Circuit opened [${key}] after ${circuit.failures} failures`,
        );
      }
      throw err;
    }
  }

  getState(key: string): CircuitState | null {
    const c = this.circuits.get(key);
    if (!c) return null;
    this.maybeTransition(key, c);
    return c.state;
  }

  private getOrCreate(
    key: string,
    options: CircuitBreakerOptions,
  ): NonNullable<ReturnType<typeof this.circuits.get>> {
    let c = this.circuits.get(key);
    if (!c) {
      c = {
        state: 'closed',
        failures: 0,
        lastFailureAt: null,
        options: {
          failureThreshold: options.failureThreshold ?? 5,
          resetAfterSeconds: options.resetAfterSeconds ?? 30,
          name: options.name ?? key,
        },
      };
      this.circuits.set(key, c);
    }
    return c;
  }

  private maybeTransition(
    key: string,
    circuit: NonNullable<ReturnType<typeof this.circuits.get>>,
  ): void {
    if (circuit.state !== 'open') return;
    const elapsed =
      (Date.now() - (circuit.lastFailureAt ?? 0)) / 1000;
    if (elapsed >= circuit.options.resetAfterSeconds) {
      circuit.state = 'half_open';
      this.logger.log(`Circuit half-open [${key}], allowing one call`);
    }
  }
}
