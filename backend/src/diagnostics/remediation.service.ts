import { Injectable, BadRequestException } from '@nestjs/common';
import { CircuitBreakerService } from '../common/circuit-breaker/circuit-breaker.service';
import { FeatureFlagsService } from './feature-flags.service';
import { RestartService } from './restart.service';
import { DomainEventBus } from '../domain-events/domain-event-bus.service';
import { DIAGNOSTICS_REMEDIATION_EXECUTED } from '../domain-events/events';
import {
  AllowedRemediationAction,
  ExecuteRemediationDto,
  RemediationAuditPayload,
} from './diagnostics.types';

/**
 * Safe remediations only. All actions require explicit approval and are fully audited.
 * Disallowed: payment retries, ledger writes, refunds.
 * Restart is platform-aware (deploy hook or process.exit) and blocked during in-flight financial transactions.
 */
@Injectable()
export class RemediationService {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly restartService: RestartService,
    private readonly domainEventBus: DomainEventBus,
  ) {}

  /**
   * Execute an allowed remediation only if approved. Rejects disallowed actions.
   * All executions are audited via DIAGNOSTICS_REMEDIATION_EXECUTED.
   */
  async execute(
    dto: ExecuteRemediationDto,
    actor: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!dto.approved) {
      throw new BadRequestException('Remediation requires explicit approval (approved: true)');
    }

    const allowed = Object.values(AllowedRemediationAction) as string[];
    if (!allowed.includes(dto.action)) {
      const payload: RemediationAuditPayload = {
        action: dto.action,
        params: (dto.params ?? {}) as Record<string, unknown>,
        actor,
        approved: dto.approved,
        result: 'failure',
        error: 'Action not allowed',
        at: new Date().toISOString(),
      };
      this.domainEventBus.publish(DIAGNOSTICS_REMEDIATION_EXECUTED, payload);
      throw new BadRequestException(
        'Action not allowed. Allowed: RESTART_PROCESS, CLEAR_CIRCUIT_BREAKER, TOGGLE_FEATURE_FLAG',
      );
    }

    const params = dto.params ?? {};
    let result: { success: boolean; message: string };
    try {
      switch (dto.action as AllowedRemediationAction) {
        case AllowedRemediationAction.CLEAR_CIRCUIT_BREAKER: {
          const key = params.key;
          if (!key) {
            throw new BadRequestException('params.key required for CLEAR_CIRCUIT_BREAKER');
          }
          this.circuitBreakerService.clearCircuit(key);
          result = { success: true, message: `Circuit ${key} cleared` };
          break;
        }
        case AllowedRemediationAction.TOGGLE_FEATURE_FLAG: {
          const key = params.key;
          const value = params.value === 'true';
          if (!key) {
            throw new BadRequestException('params.key required for TOGGLE_FEATURE_FLAG');
          }
          const scope = (params.scope as 'GLOBAL' | 'ORG' | 'ENVIRONMENT') ?? 'GLOBAL';
          const scopeId = params.scopeId ?? undefined;
          await this.featureFlagsService.set(key, value, scope, scopeId);
          result = { success: true, message: `Feature flag ${key} = ${value}` };
          break;
        }
        case AllowedRemediationAction.RESTART_PROCESS: {
          result = await this.restartService.requestRestart();
          break;
        }
        default:
          result = { success: false, message: 'Unknown action' };
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      const payload: RemediationAuditPayload = {
        action: dto.action,
        params: params as Record<string, unknown>,
        actor,
        approved: dto.approved,
        result: 'failure',
        error: e.message,
        at: new Date().toISOString(),
      };
      this.domainEventBus.publish(DIAGNOSTICS_REMEDIATION_EXECUTED, payload);
      throw err;
    }

    const auditPayload: RemediationAuditPayload = {
      action: dto.action,
      params: params as Record<string, unknown>,
      actor,
      approved: dto.approved,
      result: 'success',
      at: new Date().toISOString(),
    };
    this.domainEventBus.publish(DIAGNOSTICS_REMEDIATION_EXECUTED, auditPayload);

    return result;
  }
}
