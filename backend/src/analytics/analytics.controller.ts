import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { CurrentOrg } from '../common/decorators/current-org.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboardStats(
    @CurrentOrg() organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getDashboardStats(organizationId, query);
  }

  @Get('revenue')
  getRevenueByPeriod(
    @CurrentOrg() organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getRevenueByPeriod(organizationId, query);
  }

  @Get('invoice-status')
  getInvoiceStatusDistribution(
    @CurrentOrg() organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getInvoiceStatusDistribution(organizationId, query);
  }

  @Get('payment-methods')
  getPaymentMethodDistribution(
    @CurrentOrg() organizationId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getPaymentMethodDistribution(organizationId, query);
  }
}
