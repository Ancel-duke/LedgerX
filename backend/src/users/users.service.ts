import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { PaginationUtil, PaginationParams } from '../common/utils/pagination.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Verify role belongs to organization
    const role = await this.prisma.role.findFirst({
      where: {
        id: createUserDto.roleId,
        organizationId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found or inactive');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        isActive: createUserDto.isActive ?? true,
      },
    });

    // Link user to organization with role
    await this.prisma.userOrganization.create({
      data: {
        userId: user.id,
        organizationId,
        roleId: createUserDto.roleId,
        isActive: createUserDto.isActive ?? true,
      },
    });

    // Fetch user with role info
    const userWithOrg = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userOrganizations: {
          where: {
            organizationId,
            isActive: true,
            deletedAt: null,
          },
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: userWithOrg?.userOrganizations[0]?.role.name || 'STAFF',
      organizationId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findAll(organizationId: string, pagination: PaginationParams) {
    const { skip, take } = PaginationUtil.parseParams(pagination.page, pagination.limit);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          userOrganizations: {
            some: {
              organizationId,
              isActive: true,
              deletedAt: null,
            },
          },
          isActive: true,
          deletedAt: null,
        },
        skip,
        take,
        include: {
          userOrganizations: {
            where: {
              organizationId,
              isActive: true,
              deletedAt: null,
            },
            include: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({
        where: {
          userOrganizations: {
            some: {
              organizationId,
              isActive: true,
              deletedAt: null,
            },
          },
          isActive: true,
          deletedAt: null,
        },
      }),
    ]);

    return {
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.userOrganizations[0]?.role.name || 'STAFF',
        organizationId,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      meta: PaginationUtil.createMeta(
        pagination.page || 1,
        pagination.limit || 10,
        total,
      ),
    };
  }

  async findOne(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        userOrganizations: {
          some: {
            organizationId,
            isActive: true,
            deletedAt: null,
          },
        },
        isActive: true,
        deletedAt: null,
      },
      include: {
        userOrganizations: {
          where: {
            organizationId,
            isActive: true,
            deletedAt: null,
          },
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.userOrganizations[0]?.role.name || 'STAFF',
      organizationId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(organizationId: string, id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(organizationId, id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    const updateData: any = { ...updateUserDto };

    if (updateUserDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
      delete updateData.password;
    }

    // Update role if provided
    if (updateUserDto.roleId) {
      const role = await this.prisma.role.findFirst({
        where: {
          id: updateUserDto.roleId,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!role) {
        throw new NotFoundException('Role not found or inactive');
      }

      // Update UserOrganization role
      await this.prisma.userOrganization.updateMany({
        where: {
          userId: id,
          organizationId,
          isActive: true,
          deletedAt: null,
        },
        data: {
          roleId: updateUserDto.roleId,
        },
      });
    }

    delete updateData.roleId;

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        userOrganizations: {
          where: {
            organizationId,
            isActive: true,
            deletedAt: null,
          },
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.userOrganizations[0]?.role.name || 'STAFF',
      organizationId,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  }

  async remove(organizationId: string, id: string) {
    const user = await this.findOne(organizationId, id);
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted successfully' };
  }
}
