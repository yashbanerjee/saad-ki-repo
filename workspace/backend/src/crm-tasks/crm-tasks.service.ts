import { Injectable, NotFoundException } from '@nestjs/common';
import { CrmActivityType, CrmTaskStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreateCrmTaskDto, ListCrmTasksQueryDto, UpdateCrmTaskDto } from './dto/crm-task.dto';
import { TrashService } from '../trash/trash.service';

@Injectable()
export class CrmTasksService {
  constructor(
    private prisma: PrismaService,
    private trash: TrashService,
  ) {}

  async findAll(companyId: string, query: ListCrmTasksQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { skip, take } = paginate(page, limit);
    const where: Prisma.CrmTaskWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.dealId ? { dealId: query.dealId } : {}),
      ...(query.contactId ? { contactId: query.contactId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.crmTask.findMany({
        where,
        skip,
        take,
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          lead: { select: { id: true, title: true } },
          deal: { select: { id: true, title: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.crmTask.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const task = await this.prisma.crmTask.findFirst({ where: { id, companyId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async create(companyId: string, userId: string, dto: CreateCrmTaskDto) {
    const task = await this.prisma.crmTask.create({
      data: {
        companyId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? CrmTaskStatus.TODO,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        assignedToId: dto.assignedToId ?? userId,
        leadId: dto.leadId,
        dealId: dto.dealId,
        contactId: dto.contactId,
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (dto.leadId || dto.dealId || dto.contactId) {
      await this.prisma.crmActivity.create({
        data: {
          companyId,
          leadId: dto.leadId,
          dealId: dto.dealId,
          contactId: dto.contactId,
          createdById: userId,
          type: CrmActivityType.TASK,
          body: `Task created: ${dto.title}`,
        },
      });
    }

    return task;
  }

  async update(id: string, companyId: string, dto: UpdateCrmTaskDto) {
    await this.findOne(id, companyId);
    return this.prisma.crmTask.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.assignedToId !== undefined ? { assignedToId: dto.assignedToId } : {}),
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async remove(id: string, companyId: string, userId?: string) {
    const task = await this.findOne(id, companyId);
    await this.trash.moveToTrash({
      companyId,
      userId,
      entityType: 'crm_task',
      entityId: id,
      title: task.title,
      href: '/crm/tasks',
    });
    return { message: 'Moved to trash' };
  }
}
