import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CrmActivityType,
  CrmTaskStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { CreateCrmTaskDto, ListCrmTasksQueryDto, UpdateCrmTaskDto } from './dto/crm-task.dto';
import { TrashService } from '../trash/trash.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CrmTasksService {
  constructor(
    private prisma: PrismaService,
    private trash: TrashService,
    private notifications: NotificationsService,
  ) {}

  async findAll(companyId: string, query: ListCrmTasksQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { skip, take } = paginate(page, limit);
    const where: Prisma.CrmTaskWhereInput = {
      companyId,
      deletedAt: null,
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
          lead: { select: { id: true, title: true, ownerId: true } },
          deal: { select: { id: true, title: true, ownerId: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.crmTask.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const task = await this.prisma.crmTask.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, title: true, ownerId: true } },
        deal: { select: { id: true, title: true, ownerId: true } },
      },
    });
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
        lead: { select: { id: true, title: true, ownerId: true } },
        deal: { select: { id: true, title: true, ownerId: true } },
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

    const who = await this.actorLabel(userId);
    void this.notifications.notifyRelated({
      companyId,
      actorId: userId,
      userIds: [task.assignedToId, task.lead?.ownerId, task.deal?.ownerId],
      type: NotificationType.ASSIGNMENT,
      title: `${who} created CRM task`,
      body: task.title,
      data: {
        crmTaskId: task.id,
        leadId: task.leadId,
        dealId: task.dealId,
        href: '/crm/tasks',
      },
    });

    return task;
  }

  async update(id: string, companyId: string, userId: string, dto: UpdateCrmTaskDto) {
    const existing = await this.findOne(id, companyId);
    const statusChanged = dto.status !== undefined && dto.status !== existing.status;
    const assigneeChanged =
      dto.assignedToId !== undefined && dto.assignedToId !== existing.assignedToId;
    const dueChanged =
      dto.dueDate !== undefined &&
      (dto.dueDate ? new Date(dto.dueDate).getTime() : null) !==
        (existing.dueDate?.getTime() ?? null);

    const task = await this.prisma.crmTask.update({
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
        lead: { select: { id: true, title: true, ownerId: true } },
        deal: { select: { id: true, title: true, ownerId: true } },
      },
    });

    const who = await this.actorLabel(userId);
    const related = [
      task.assignedToId,
      existing.assignedToId,
      task.lead?.ownerId,
      task.deal?.ownerId,
    ];

    if (assigneeChanged) {
      void this.notifications.notifyRelated({
        companyId,
        actorId: userId,
        userIds: related,
        type: NotificationType.ASSIGNMENT,
        title: `${who} assigned CRM task`,
        body: task.title,
        data: {
          crmTaskId: task.id,
          leadId: task.leadId,
          dealId: task.dealId,
          href: '/crm/tasks',
        },
      });
    } else if (statusChanged) {
      void this.notifications.notifyRelated({
        companyId,
        actorId: userId,
        userIds: related,
        type: NotificationType.STATUS_CHANGE,
        title: `${who} updated CRM task status`,
        body: `${task.title} → ${dto.status}`,
        data: {
          crmTaskId: task.id,
          leadId: task.leadId,
          dealId: task.dealId,
          href: '/crm/tasks',
        },
      });
    } else if (dueChanged) {
      void this.notifications.notifyRelated({
        companyId,
        actorId: userId,
        userIds: related,
        type: NotificationType.DUE_REMINDER,
        title: `${who} changed CRM task due date`,
        body: task.dueDate
          ? `${task.title} due ${task.dueDate.toLocaleString()}`
          : `${task.title} — due date cleared`,
        data: {
          crmTaskId: task.id,
          leadId: task.leadId,
          dealId: task.dealId,
          href: '/crm/tasks',
        },
      });
    }

    return task;
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

  private async actorLabel(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) return 'Someone';
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Someone';
  }
}
