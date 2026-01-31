import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../database/postgres/prisma.service';
import { UsersService } from '../users/users.service';
import { LedgerBootstrapService } from '../ledger/ledger-bootstrap.service';
import { DomainEventBus } from '../domain-events/domain-event-bus.service';
import { SmtpEmailService } from '../email/smtp-email.service';
import {
  PASSWORD_RESET_REQUESTED,
  PASSWORD_RESET_COMPLETED,
} from '../domain-events/events';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const RESET_TOKEN_EXPIRY_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private ledgerBootstrapService: LedgerBootstrapService,
    private domainEventBus: DomainEventBus,
    private emailService: SmtpEmailService,
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

    const tokens = await this.generateTokens(user.id, user.email, 'ADMIN', organization.id, user.tokenVersion);

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
    const tokens = await this.generateTokens(user.id, user.email, roleName, userOrg.organizationId, user.tokenVersion);

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

  /**
   * Forgot password: always returns 200 to prevent email enumeration.
   * If user exists, creates single-use reset token (hashed + expiry) and emits PASSWORD_RESET_REQUESTED.
   * Never log or expose the raw token.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email?.trim()?.toLowerCase();
    if (!email) {
      return { message: 'If an account exists, you will receive reset instructions.' };
    }

    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true, deletedAt: null },
    });

    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      this.domainEventBus.publish(PASSWORD_RESET_REQUESTED, { userId: user.id });

      if (this.emailService.isConfigured()) {
        const baseUrl = (this.configService.get<string>('email.resetBaseUrl') ?? '').replace(/\/$/, '');
        const resetLink = `${baseUrl}/auth/reset-password?token=${rawToken}`;
        await this.emailService.sendPasswordResetLink(user.email, resetLink);
      }
    }

    return { message: 'If an account exists, you will receive reset instructions.' };
  }

  /**
   * Reset password: validates token (hash + expiry, single-use), updates password,
   * increments tokenVersion to invalidate all existing JWTs, emits PASSWORD_RESET_COMPLETED.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex');
    const now = new Date();

    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });

    if (!resetRecord) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: now },
      }),
    ]);

    this.domainEventBus.publish(PASSWORD_RESET_COMPLETED, {
      userId: resetRecord.userId,
    });

    return { message: 'Password has been reset. You can sign in with your new password.' };
  }

  /**
   * Current user + organization (for /auth/me). Returns user, current org, and list of orgs for switcher.
   */
  async getMe(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userOrganizations: {
          where: { isActive: true, deletedAt: null },
          include: {
            organization: { select: { id: true, name: true, slug: true, isActive: true } },
            role: { select: { name: true } },
          },
        },
      },
    });
    if (!user || user.userOrganizations.length === 0) {
      throw new UnauthorizedException('User not found or inactive');
    }
    const currentUo = user.userOrganizations.find((uo) => uo.organizationId === organizationId)
      ?? user.userOrganizations[0];
    if (!currentUo.organization.isActive) {
      throw new UnauthorizedException('Current organization is inactive');
    }
    const organizations = user.userOrganizations.map((uo) => ({
      id: uo.organization.id,
      name: uo.organization.name,
      slug: uo.organization.slug,
    }));
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: currentUo.role.name,
        organizationId: currentUo.organizationId,
      },
      organization: {
        id: currentUo.organization.id,
        name: currentUo.organization.name,
        slug: currentUo.organization.slug,
      },
      organizations,
    };
  }

  /**
   * Switch current organization (returns new tokens with new organizationId).
   * User must belong to the target organization.
   */
  async switchOrganization(userId: string, organizationId: string) {
    const userOrg = await this.prisma.userOrganization.findFirst({
      where: {
        userId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        user: { select: { id: true, email: true, tokenVersion: true } },
        organization: { select: { isActive: true } },
        role: { select: { name: true } },
      },
    });
    if (!userOrg || !userOrg.user || !userOrg.organization.isActive) {
      throw new UnauthorizedException('User does not have access to this organization');
    }
    const tokens = await this.generateTokens(
      userOrg.user.id,
      userOrg.user.email,
      userOrg.role.name,
      organizationId,
      userOrg.user.tokenVersion,
    );
    return { ...tokens };
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

      if (payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const userOrg = user.userOrganizations[0];
      return await this.generateTokens(user.id, user.email, userOrg.role.name, userOrg.organizationId, user.tokenVersion);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    organizationId: string,
    tokenVersion: number,
  ) {
    const payload = { sub: userId, email, role, organizationId, tokenVersion };

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
