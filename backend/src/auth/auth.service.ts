import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../database/postgres/prisma.service';
import { UsersService } from '../users/users.service';
import { LedgerBootstrapService } from '../ledger/ledger-bootstrap.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private ledgerBootstrapService: LedgerBootstrapService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: registerDto.organizationSlug || this.slugify(registerDto.organizationName) },
    });

    if (existingOrg) {
      throw new ConflictException('Organization with this slug already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: registerDto.organizationName,
        slug: registerDto.organizationSlug || this.slugify(registerDto.organizationName),
      },
    });

    await this.ledgerBootstrapService.ensureDefaults(organization.id);

    // Create default roles for the organization
    const adminRole = await this.prisma.role.create({
      data: {
        organizationId: organization.id,
        name: 'ADMIN',
        permissions: { all: true },
      },
    });

    const managerRole = await this.prisma.role.create({
      data: {
        organizationId: organization.id,
        name: 'MANAGER',
        permissions: { manage: true },
      },
    });

    const staffRole = await this.prisma.role.create({
      data: {
        organizationId: organization.id,
        name: 'STAFF',
        permissions: { view: true },
      },
    });

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
      },
    });

    // Link user to organization with ADMIN role
    await this.prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        roleId: adminRole.id,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, 'ADMIN', organization.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: 'ADMIN',
        organizationId: organization.id,
      },
      organization,
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
      include: {
        userOrganizations: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          include: {
            organization: true,
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get the first active organization (in production, you might want to handle multiple orgs)
    const userOrg = user.userOrganizations[0];

    if (!userOrg || !userOrg.organization.isActive) {
      throw new UnauthorizedException('Organization is inactive');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roleName = userOrg.role.name;
    const tokens = await this.generateTokens(user.id, user.email, roleName, userOrg.organizationId);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: roleName,
        organizationId: userOrg.organizationId,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshTokenDto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userOrganizations: {
            where: {
              isActive: true,
              deletedAt: null,
              organizationId: payload.organizationId,
            },
            include: {
              role: true,
            },
            take: 1,
          },
        },
      });

      if (!user || !user.isActive || user.userOrganizations.length === 0) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const userOrg = user.userOrganizations[0];
      return await this.generateTokens(user.id, user.email, userOrg.role.name, userOrg.organizationId);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(userId: string, email: string, role: string, organizationId: string) {
    const payload = { sub: userId, email, role, organizationId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.expiration'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiration'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
