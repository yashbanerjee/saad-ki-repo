import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, query: ListOrganizationsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = paginate(page, limit);
    const where: Prisma.OrganizationWhereInput = {
      companyId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { website: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { contacts: true, leads: true, deals: true, clients: true } },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, companyId },
      include: {
        contacts: { take: 50, orderBy: { firstName: 'asc' } },
        leads: { take: 20, orderBy: { updatedAt: 'desc' } },
        deals: { take: 20, orderBy: { updatedAt: 'desc' } },
        _count: { select: { contacts: true, leads: true, deals: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(companyId: string, dto: CreateOrganizationDto) {
    return this.prisma.organization.create({ data: { companyId, ...dto } });
  }

  async update(id: string, companyId: string, dto: UpdateOrganizationDto) {
    await this.findOne(id, companyId);
    return this.prisma.organization.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.organization.delete({ where: { id } });
    return { message: 'Organization deleted' };
  }
}
