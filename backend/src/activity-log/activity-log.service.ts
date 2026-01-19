import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog, ActivityLogDocument } from './schemas/activity-log.schema';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name)
    private activityLogModel: Model<ActivityLogDocument>,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    createActivityLogDto: CreateActivityLogDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const activityLog = new this.activityLogModel({
      organizationId,
      userId,
      ...createActivityLogDto,
      ipAddress,
      userAgent,
    });

    return activityLog.save();
  }

  async findAll(
    organizationId: string,
    page: number = 1,
    limit: number = 10,
    entityType?: string,
    userId?: string,
  ) {
    const skip = (page - 1) * limit;
    const query: any = { organizationId };

    if (entityType) {
      query.entityType = entityType;
    }

    if (userId) {
      query.userId = userId;
    }

    const [data, total] = await Promise.all([
      this.activityLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.activityLogModel.countDocuments(query),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.activityLogModel
        .find({
          organizationId,
          entityType,
          entityId,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.activityLogModel.countDocuments({
        organizationId,
        entityType,
        entityId,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
