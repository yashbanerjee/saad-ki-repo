import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, page = 1, limit = 20) {
    const { skip, take } = paginate(page, limit);
    const where = { companyId };
    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { projects: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: { projects: true, _count: { select: { documents: true, formSubmissions: true } } },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(companyId: string, dto: CreateClientDto) {
    return this.prisma.client.create({
      data: { companyId, ...dto },
    });
  }

  async update(id: string, companyId: string, dto: UpdateClientDto) {
    await this.findOne(id, companyId);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.client.update({ where: { id }, data: { status: 'inactive' } });
    return { message: 'Client deactivated' };
  }
}
