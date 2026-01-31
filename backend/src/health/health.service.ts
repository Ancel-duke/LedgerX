import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  liveness(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<{ status: string; db?: string; timestamp: string }> {
    const result: { status: string; db?: string; timestamp: string } = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.db = 'up';
    } catch {
      result.status = 'degraded';
      result.db = 'down';
    }
    return result;
  }
}
