import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { DiagnosticsService } from './diagnostics.service';
import { RemediationService } from './remediation.service';
import { FeatureFlagsService } from './feature-flags.service';
import { ScheduledJobsRegistryService } from '../common/scheduled-jobs/scheduled-jobs-registry.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ExecuteRemediationDto } from './dto/execute-remediation.dto';

/**
 * AI-assisted diagnostics: read-only, advisory. Restricted to admin/compliance roles.
 * All remediations require explicit approval and are fully audited.
 */
@Controller('diagnostics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class DiagnosticsController {
  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly remediationService: RemediationService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly jobsRegistry: ScheduledJobsRegistryService,
  ) {}

  /** Current aggregated metrics and circuit states (read-only). */
  @Get('aggregates')
  async getAggregates() {
    return this.diagnosticsService.getAggregates();
  }

  /** Last generated diagnostic report (read-only; from memory or DB). */
  @Get('report')
  async getReport() {
    const report = await this.diagnosticsService.getLastReport();
    if (!report) {
      return { message: 'No report yet; run scheduled diagnostics or trigger manually.' };
    }
    return report;
  }

  /** Report history (newest first). Query: limit (default 50, max 100). */
  @Get('report/history')
  async getReportHistory(@Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    return this.diagnosticsService.getReportHistory(n);
  }

  /** Compare current snapshot vs previous report. */
  @Get('report/compare')
  async getReportCompare() {
    const result = await this.diagnosticsService.getCompare();
    if (!result) return { message: 'Unable to generate comparison.' };
    return result;
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

  /** Non-financial feature flags (read-only list). Optional query: orgId, environment for scoped resolution. */
  @Get('feature-flags')
  async getFeatureFlags(
    @Query('orgId') orgId?: string,
    @Query('environment') environment?: string,
  ) {
    return this.featureFlagsService.getAll(orgId, environment);
  }

  /** Feature flag rows (key, scope, scopeId, value) for admin visibility. */
  @Get('feature-flags/rows')
  async getFeatureFlagRows() {
    return this.featureFlagsService.listRows();
  }

  /** List scheduled jobs with last run time and status. */
  @Get('jobs')
  getJobs() {
    return this.jobsRegistry.list();
  }
}
