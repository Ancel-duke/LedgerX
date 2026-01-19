import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/postgres/prisma.service';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.organizationId) {
      throw new ForbiddenException('Organization context required');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { id: true, isActive: true },
    });

    if (!organization) {
      throw new ForbiddenException('Organization not found');
    }

    if (!organization.isActive) {
      throw new ForbiddenException('Organization is inactive');
    }

    return true;
  }
}
