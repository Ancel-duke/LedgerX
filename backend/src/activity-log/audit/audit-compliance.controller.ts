import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { AuditComplianceRecordService } from './audit-compliance-record.service';

/**
 * Audit & Compliance: read-only endpoints. Restricted to admin/compliance roles.
 * Append-only store; no update/delete APIs.
 */
@Controller('audit-compliance')
@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class AuditComplianceController {
  constructor(
    private readonly auditComplianceRecordService: AuditComplianceRecordService,
  ) {}

  /**
   * Entity audit history: timeline of audit records for a given entity (e.g. PAYMENT, LEDGER_TRANSACTION).
   */
  @Get('entity/:entityType/:entityId')
  getEntityAuditHistory(
    @CurrentOrg() organizationId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const pageNum = page && page > 0 ? page : 1;
    const limitNum = limit && limit > 0 && limit <= 100 ? limit : 20;
    return this.auditComplianceRecordService.getEntityAuditHistory(
      organizationId,
      entityType,
      entityId,
      pageNum,
      limitNum,
    );
  }

  /**
   * Time-range export: audit records within [from, to] for compliance export.
   * Query params: from (ISO date), to (ISO date), page, limit.
   */
  @Get('export')
  getTimeRangeExport(
    @CurrentOrg() organizationId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Query params "from" and "to" must be valid ISO dates');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('"from" must be before or equal to "to"');
    }
    const pageNum = page && page > 0 ? page : 1;
    const limitNum = limit && limit > 0 && limit <= 500 ? limit : 100;
    return this.auditComplianceRecordService.getTimeRangeExport(
      organizationId,
      fromDate,
      toDate,
      pageNum,
      limitNum,
    );
  }
}
