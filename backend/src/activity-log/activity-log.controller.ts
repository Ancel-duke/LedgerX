import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CurrentOrg } from '../common/decorators/current-org.decorator';
import { Request } from 'express';

@Controller('activity-log')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() createActivityLogDto: CreateActivityLogDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    return this.activityLogService.create(
      organizationId,
      user.id,
      createActivityLogDto,
      ipAddress,
      userAgent,
    );
  }

  @Get()
  findAll(
    @CurrentOrg() organizationId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
  ) {
    return this.activityLogService.findAll(
      organizationId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      entityType,
      userId,
    );
  }

  @Get('entity/:entityType/:entityId')
  findByEntity(
    @CurrentOrg() organizationId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activityLogService.findByEntity(
      organizationId,
      entityType,
      entityId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }
}
