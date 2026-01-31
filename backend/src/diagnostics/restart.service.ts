import { Injectable, BadRequestException } from '@nestjs/common';
import { InFlightFinancialService } from '../common/in-flight-financial/in-flight-financial.service';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';

/**
 * Platform-aware restart: use platform API (e.g. Render deploy hook) when available,
 * else process.exit(). Never restarts during in-flight financial transactions.
 */
@Injectable()
export class RestartService {
  private readonly logger = new StructuredLoggerService(RestartService.name);
  private readonly deployHookUrl: string | null;
  private readonly exitCode: number;

  constructor(private readonly inFlightFinancial: InFlightFinancialService) {
    this.deployHookUrl = process.env.RENDER_DEPLOY_HOOK_URL ?? process.env.DEPLOY_HOOK_URL ?? null;
    const code = process.env.RESTART_EXIT_CODE;
    this.exitCode = code ? parseInt(code, 10) : 0;
  }

  /**
   * Request process restart. Throws if in-flight financial transactions.
   * When RENDER_DEPLOY_HOOK_URL (or DEPLOY_HOOK_URL) is set, triggers deploy; otherwise process.exit(exitCode).
   */
  async requestRestart(): Promise<{ success: boolean; message: string }> {
    if (this.inFlightFinancial.hasInFlight()) {
      throw new BadRequestException(
        'Restart blocked: in-flight financial transactions. Retry after operations complete.',
      );
    }

    if (this.deployHookUrl) {
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 15_000);
        const res = await fetch(this.deployHookUrl, {
          method: 'POST',
          signal: controller.signal,
        });
        clearTimeout(t);
        if (res.ok) {
          this.logger.log('Restart requested via platform deploy hook');
          return { success: true, message: 'Restart requested via platform (deploy hook)' };
        }
        this.logger.warn('Deploy hook returned non-OK, falling back to process.exit', { status: res.status });
      } catch (err) {
        this.logger.warn('Deploy hook failed, falling back to process.exit', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    this.logger.log('Restarting process via process.exit');
    setTimeout(() => process.exit(this.exitCode), 500);
    return { success: true, message: 'Process will restart shortly' };
  }
}
