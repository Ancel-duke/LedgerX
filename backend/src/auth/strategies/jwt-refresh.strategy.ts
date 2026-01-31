import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/postgres/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret'),
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userOrganizations: {
          where: {
            organizationId: payload.organizationId,
            isActive: true,
            deletedAt: null,
          },
          include: {
            organization: {
              select: {
                id: true,
                isActive: true,
              },
            },
            role: {
              select: {
                name: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!user || !user.isActive || user.userOrganizations.length === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userOrg = user.userOrganizations[0];
    if (!userOrg.organization.isActive) {
      throw new UnauthorizedException('Organization is inactive');
    }

    return {
      id: user.id,
      email: user.email,
      role: userOrg.role.name,
      organizationId: userOrg.organizationId,
    };
  }
}
