import { Injectable } from '@nestjs/common';

/**
 * Non-financial feature flags only. Used for toggles like verbose diagnostics.
 * No payment, ledger, or refund toggles. All changes are audited via remediation.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly flags = new Map<string, boolean>();

  /** Allowed flag keys (non-financial). Add new keys here to allow toggling. */
  private static readonly ALLOWED_KEYS = new Set([
    'diagnostics_verbose',
    'extra_logging',
  ]);

  get(key: string): boolean {
    if (!FeatureFlagsService.ALLOWED_KEYS.has(key)) {
      return false;
    }
    return this.flags.get(key) ?? false;
  }

  set(key: string, value: boolean): void {
    if (!FeatureFlagsService.ALLOWED_KEYS.has(key)) {
      throw new Error(`Feature flag not allowed: ${key}`);
    }
    this.flags.set(key, value);
  }

  getAll(): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    FeatureFlagsService.ALLOWED_KEYS.forEach((k) => {
      out[k] = this.flags.get(k) ?? false;
    });
    return out;
  }
}
