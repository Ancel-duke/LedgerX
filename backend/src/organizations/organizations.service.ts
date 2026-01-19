import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { PaginationUtil, PaginationParams } from '../common/utils/pagination.util';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const slug = createOrganizationDto.slug || this.slugify(createOrganizationDto.name);

    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      throw new ConflictException('Organization with this slug already exists');
    }

    const organization = await this.prisma.organization.create({
      data: {
        ...createOrganizationDto,
        slug,
        isActive: createOrganizationDto.isActive ?? true,
      },
    });

    return organization;
  }

  async findAll(pagination: PaginationParams) {
    const { skip, take } = PaginationUtil.parseParams(pagination.page, pagination.limit);

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count(),
    ]);

    return {
      data: organizations,
      meta: PaginationUtil.createMeta(
        pagination.page || 1,
        pagination.limit || 10,
        total,
      ),
    };
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(id: string, updateOrganizationDto: UpdateOrganizationDto) {
    const organization = await this.findOne(id);

    if (updateOrganizationDto.slug && updateOrganizationDto.slug !== organization.slug) {
      const existingOrg = await this.prisma.organization.findUnique({
        where: { slug: updateOrganizationDto.slug },
      });

      if (existingOrg) {
        throw new ConflictException('Organization with this slug already exists');
      }
    }

    const updatedOrganization = await this.prisma.organization.update({
      where: { id },
      data: updateOrganizationDto,
    });

    return updatedOrganization;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.organization.delete({ where: { id } });
    return { message: 'Organization deleted successfully' };
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
