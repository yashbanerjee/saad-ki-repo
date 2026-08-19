import { Injectable, NotFoundException } from '@nestjs/common';
import { DealStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreateDealDto, ListDealsQueryDto, UpdateDealDto } from './dto/deal.dto';
import { TrashService } from '../trash/trash.service';

@Injectable()
export class DealsService {
  constructor(
    private prisma: PrismaService,
    private trash: TrashService,
  ) {}

  async findAll(companyId: string, query: ListDealsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { skip, take } = paginate(page, limit);

    const where: Prisma.DealWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          client: { select: { id: true, name: true, type: true } },
          lead: { select: { id: true, title: true, status: true } },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, companyId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        client: true,
        lead: true,
        organization: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async create(companyId: string, userId: string, dto: CreateDealDto) {
    return this.prisma.deal.create({
      data: {
        companyId,
        title: dto.title,
        amount: dto.amount,
        status: dto.status ?? DealStatus.OPEN,
        leadId: dto.leadId,
        clientId: dto.clientId,
        organizationId: dto.organizationId,
        ownerId: dto.ownerId ?? userId,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
        notes: dto.notes,
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true, type: true } },
        lead: { select: { id: true, title: true } },
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateDealDto) {
    await this.findOne(id, companyId);
    return this.prisma.deal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
        ...(dto.expectedCloseDate !== undefined
          ? {
              expectedCloseDate: dto.expectedCloseDate
                ? new Date(dto.expectedCloseDate)
                : null,
            }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.lostReason !== undefined ? { lostReason: dto.lostReason } : {}),
        ...(dto.lostNotes !== undefined ? { lostNotes: dto.lostNotes } : {}),
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, name: true, type: true } },
        lead: { select: { id: true, title: true } },
      },
    });
  }

  async remove(id: string, companyId: string, userId?: string) {
    const deal = await this.findOne(id, companyId);
    await this.trash.moveToTrash({
      companyId,
      userId,
      entityType: 'deal',
      entityId: id,
      title: deal.title,
      href: `/deals/${id}`,
    });
    return { message: 'Moved to trash' };
  }

  async pipelineSummary(companyId: string) {
    const openStatuses: DealStatus[] = [
      DealStatus.OPEN,
      DealStatus.QUALIFICATION,
      DealStatus.PROPOSAL,
      DealStatus.NEGOTIATION,
    ];
    const groups = await this.prisma.deal.groupBy({
      by: ['status'],
      where: { companyId },
      _count: true,
      _sum: { amount: true },
    });

    const byStatus = Object.fromEntries(
      Object.values(DealStatus).map((s) => [s, { count: 0, amount: 0 }]),
    ) as Record<DealStatus, { count: number; amount: number }>;

    for (const g of groups) {
      byStatus[g.status] = {
        count: g._count,
        amount: Number(g._sum.amount ?? 0),
      };
    }

    const pipelineValue = openStatuses.reduce(
      (sum, s) => sum + byStatus[s].amount,
      0,
    );
    const pipelineCount = openStatuses.reduce((sum, s) => sum + byStatus[s].count, 0);

    return { byStatus, pipelineValue, pipelineCount };
  }
}
