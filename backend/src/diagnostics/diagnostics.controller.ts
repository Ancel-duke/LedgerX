import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';
import { RemediationService } from './remediation.service';
import { FeatureFlagsService } from './feature-flags.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExecuteRemediationDto } from './dto/execute-remediation.dto';

/**
 * AI-assisted diagnostics: read-only, advisory. No auto-actions on financial data.
 * All remediations require explicit approval and are fully audited.
 */
@Controller('diagnostics')
@UseGuards(JwtAuthGuard)
export class DiagnosticsController {
  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly remediationService: RemediationService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  /** Current aggregated metrics and circuit states (read-only). */
  @Get('aggregates')
  async getAggregates() {
    return this.diagnosticsService.getAggregates();
  }

  /** Last generated diagnostic report (read-only). */
  @Get('report')
  async getReport() {
    const report = this.diagnosticsService.getLastReport();
    if (!report) {
      return { message: 'No report yet; run scheduled diagnostics or trigger manually.' };
    }
    return report;
  }

  /** Trigger report generation (advisory only; logged, no auto-action). */
  @Post('report/generate')
  async generateReport() {
    return this.diagnosticsService.generateDiagnosticReport();
  }

  /**
   * Execute an allowed remediation only if approved.
   * Allowed: RESTART_PROCESS, CLEAR_CIRCUIT_BREAKER, TOGGLE_FEATURE_FLAG.
   * Disallowed: payment retries, ledger writes, refunds.
   * All executions are fully audited.
   */
  @Post('remediations/execute')
  async executeRemediation(
    @Body() dto: ExecuteRemediationDto,
    @CurrentUser() user: { id: string },
  ) {
    const actor = user?.id ?? 'unknown';
    return this.remediationService.execute(dto, actor);
  }

  /** Non-financial feature flags (read-only list). */
  @Get('feature-flags')
  getFeatureFlags() {
    return this.featureFlagsService.getAll();
  }
}
