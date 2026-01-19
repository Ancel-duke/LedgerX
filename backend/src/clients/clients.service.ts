import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../database/postgres/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PaginationUtil, PaginationParams } from '../common/utils/pagination.util';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, createClientDto: CreateClientDto) {
    // Check if client with same email exists in organization
    if (createClientDto.email) {
      const existingClient = await this.prisma.client.findFirst({
        where: {
          organizationId,
          email: createClientDto.email,
          deletedAt: null,
        },
      });

      if (existingClient) {
        throw new ConflictException('Client with this email already exists');
      }
    }

    const client = await this.prisma.client.create({
      data: {
        ...createClientDto,
        organizationId,
        isActive: createClientDto.isActive ?? true,
      },
    });

    return client;
  }

  async findAll(organizationId: string, pagination: PaginationParams, includeDeleted = false) {
    const { skip, take } = PaginationUtil.parseParams(pagination.page, pagination.limit);

    const where: any = {
      organizationId,
      ...(includeDeleted ? {} : { deletedAt: null }),
    };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients,
      meta: PaginationUtil.createMeta(
        pagination.page || 1,
        pagination.limit || 10,
        total,
      ),
    };
  }

  async findOne(organizationId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        invoices: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
            dueDate: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(organizationId: string, id: string, updateClientDto: UpdateClientDto) {
    const client = await this.findOne(organizationId, id);

    // Check email uniqueness if being updated
    if (updateClientDto.email && updateClientDto.email !== client.email) {
      const existingClient = await this.prisma.client.findFirst({
        where: {
          organizationId,
          email: updateClientDto.email,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existingClient) {
        throw new ConflictException('Client with this email already exists');
      }
    }

    const updatedClient = await this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });

    return updatedClient;
  }

  async remove(organizationId: string, id: string) {
    const client = await this.findOne(organizationId, id);

    // Check if client has invoices
    const invoiceCount = await this.prisma.invoice.count({
      where: {
        clientId: id,
        deletedAt: null,
      },
    });

    if (invoiceCount > 0) {
      // Soft delete
      await this.prisma.client.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { message: 'Client soft deleted (has associated invoices)' };
    } else {
      // Hard delete if no invoices
      await this.prisma.client.delete({ where: { id } });
      return { message: 'Client deleted successfully' };
    }
  }
}
