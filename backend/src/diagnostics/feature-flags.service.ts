import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';

/** Scope for feature flags: global, per-org, or per-environment. */
export type FeatureFlagScope = 'GLOBAL' | 'ORG' | 'ENVIRONMENT';

/**
 * DB-backed feature flags. Non-financial toggles only (e.g. diagnostics_verbose).
 * No payment, ledger, or refund toggles. Resolve order: ORG+scopeId > ENVIRONMENT+scopeId > GLOBAL.
 */
@Injectable()
export class FeatureFlagsService {
  /** Allowed flag keys (non-financial). Add new keys here to allow toggling. */
  private static readonly ALLOWED_KEYS = new Set([
    'diagnostics_verbose',
    'diagnostics_ai',
    'extra_logging',
  ]);

  constructor(private readonly prisma: PrismaService) {}

  /** Sentinel for GLOBAL scope (DB unique treats NULLs as distinct; use '' for global). */
  private static readonly GLOBAL_SCOPE_ID = '';

  /**
   * Get flag value. Resolves: org override > environment override > global.
   * orgId and environment are optional; when provided, org takes precedence over environment.
   */
  async get(key: string, orgId?: string, environment?: string): Promise<boolean> {
    if (!FeatureFlagsService.ALLOWED_KEYS.has(key)) return false;
    try {
      if (orgId) {
        const row = await this.prisma.featureFlag.findUnique({
          where: { key_scope_scopeId: { key, scope: 'ORG', scopeId: orgId } },
        });
        if (row) return row.value;
      }
      if (environment) {
        const row = await this.prisma.featureFlag.findUnique({
          where: { key_scope_scopeId: { key, scope: 'ENVIRONMENT', scopeId: environment } },
        });
        if (row) return row.value;
      }
      const globalRow = await this.prisma.featureFlag.findUnique({
        where: { key_scope_scopeId: { key, scope: 'GLOBAL', scopeId: FeatureFlagsService.GLOBAL_SCOPE_ID } },
      });
      return globalRow?.value ?? false;
    } catch {
      return false;
    }
  }

  /** Sync get for in-process use when async is not available (falls back to global only). */
  getSync(key: string): boolean {
    if (!FeatureFlagsService.ALLOWED_KEYS.has(key)) return false;
    return false; // DB-backed: sync resolution not supported; use get() with orgId/env
  }

  set(key: string, value: boolean, scope: FeatureFlagScope = 'GLOBAL', scopeId?: string | null): Promise<void> {
    if (!FeatureFlagsService.ALLOWED_KEYS.has(key)) {
      throw new Error(`Feature flag not allowed: ${key}`);
    }
    const scopeIdVal = scope === 'GLOBAL' ? FeatureFlagsService.GLOBAL_SCOPE_ID : (scopeId ?? null);
    const scopeIdForPrisma = scopeIdVal ?? '';
    return this.prisma.featureFlag
      .upsert({
        where: { key_scope_scopeId: { key, scope, scopeId: scopeIdForPrisma } },
        create: { key, value, scope, scopeId: scopeIdVal },
        update: { value },
      })
      .then(() => undefined);
  }

  /** List all flags (global + optional org/env). For admin visibility. */
  async getAll(orgId?: string, environment?: string): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const k of FeatureFlagsService.ALLOWED_KEYS) {
      out[k] = await this.get(k, orgId, environment);
    }
    return out;
  }

  /** List all rows (for admin UI: key, scope, scopeId, value). */
  async listRows(): Promise<Array<{ key: string; scope: string; scopeId: string | null; value: boolean }>> {
    try {
      const rows = await this.prisma.featureFlag.findMany({
        orderBy: [{ key: 'asc' }, { scope: 'asc' }],
      });
      return rows.map((r) => ({ key: r.key, scope: r.scope, scopeId: r.scopeId, value: r.value }));
    } catch {
      return [];
    }
  }
}
