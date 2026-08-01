import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, ListClientsQueryDto, UpdateClientDto } from './dto/client.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, query: ListClientsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = paginate(page, limit);

    const where: Prisma.ClientWhereInput = {
      companyId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { companyName: { contains: query.search, mode: 'insensitive' } },
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take,
        include: {
          organization: { select: { id: true, name: true } },
          convertedFromLead: { select: { id: true, title: true } },
          _count: { select: { projects: true, deals: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: {
        organization: true,
        convertedFromLead: true,
        projects: true,
        deals: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { documents: true, formSubmissions: true, deals: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(companyId: string, dto: CreateClientDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.client.findFirst({
      where: { companyId, email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException(`A client with email ${email} already exists`);
    }

    const type = dto.type ?? ClientType.COMPANY;
    let name = dto.name;
    if (type === ClientType.INDIVIDUAL && !name && (dto.firstName || dto.lastName)) {
      name = [dto.firstName, dto.lastName].filter(Boolean).join(' ');
    }

    return this.prisma.client.create({
      data: {
        companyId,
        type,
        name,
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        companyName: dto.companyName ?? (type === ClientType.COMPANY ? name : undefined),
        website: dto.website,
        organizationId: dto.organizationId,
        address: dto.address,
        city: dto.city,
        country: dto.country,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateClientDto) {
    await this.findOne(id, companyId);
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const clash = await this.prisma.client.findFirst({
        where: {
          companyId,
          email: { equals: email, mode: 'insensitive' },
          NOT: { id },
        },
      });
      if (clash) {
        throw new ConflictException(`A client with email ${email} already exists`);
      }
    }
    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.email ? { email: dto.email.trim().toLowerCase() } : {}),
      },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.client.update({ where: { id }, data: { status: 'inactive' } });
    return { message: 'Client deactivated' };
  }
}
