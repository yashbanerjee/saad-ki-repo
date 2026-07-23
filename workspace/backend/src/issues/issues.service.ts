import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateIssueDto,
  UpdateIssueDto,
  TransitionIssueDto,
  CreateCommentDto,
  IssueFilterDto,
} from './dto/issue.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class IssuesService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  async findAll(companyId: string, filters: IssueFilterDto, page = 1, limit = 20) {
    const { skip, take } = paginate(page, limit);
    const where = {
      project: { companyId },
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' as const } },
              { key: { contains: filters.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        skip,
        take,
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          reporter: { select: { id: true, firstName: true, lastName: true } },
          project: { select: { id: true, key: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.issue.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id, project: { companyId } },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, key: true, name: true } },
        sprint: true,
        comments: {
          include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
        labels: { include: { label: true } },
        watchers: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        children: { select: { id: true, key: true, title: true, status: true, type: true } },
      },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  async create(companyId: string, reporterId: string, dto: CreateIssueDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, companyId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const lastIssue = await this.prisma.issue.findFirst({
      where: { projectId: dto.projectId },
      orderBy: { number: 'desc' },
    });
    const number = (lastIssue?.number ?? 0) + 1;
    const key = `${project.key}-${number}`;

    const issue = await this.prisma.issue.create({
      data: {
        projectId: dto.projectId,
        number,
        key,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority,
        severity: dto.severity,
        assigneeId: dto.assigneeId,
        reporterId,
        sprintId: dto.sprintId,
        parentId: dto.parentId,
        storyPoints: dto.storyPoints,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { key: true } },
      },
    });

    await this.activity.log({
      companyId,
      userId: reporterId,
      projectId: dto.projectId,
      entityType: 'Issue',
      entityId: issue.id,
      action: 'created',
      message: `Created issue ${key}`,
    });

    return issue;
  }

  async update(id: string, companyId: string, userId: string, dto: UpdateIssueDto) {
    const existing = await this.findOne(id, companyId);
    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority,
        severity: dto.severity,
        assigneeId: dto.assigneeId,
        sprintId: dto.sprintId,
        storyPoints: dto.storyPoints,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.activity.log({
      companyId,
      userId,
      projectId: existing.projectId,
      entityType: 'Issue',
      entityId: id,
      action: 'updated',
      message: `Updated issue ${existing.key}`,
    });

    return issue;
  }

  async transition(id: string, companyId: string, userId: string, dto: TransitionIssueDto) {
    const existing = await this.findOne(id, companyId);
    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        status: dto.status,
        resolvedAt: ['DONE', 'CANCELLED'].includes(dto.status) ? new Date() : undefined,
        closedAt: dto.status === 'DONE' ? new Date() : undefined,
      },
    });

    await this.activity.log({
      companyId,
      userId,
      projectId: existing.projectId,
      entityType: 'Issue',
      entityId: id,
      action: 'status_changed',
      message: `${existing.key} moved to ${dto.status}`,
      metadata: { from: existing.status, to: dto.status },
    });

    return issue;
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.issue.delete({ where: { id } });
    return { message: 'Issue deleted' };
  }

  async addComment(id: string, companyId: string, authorId: string, dto: CreateCommentDto) {
    const issue = await this.findOne(id, companyId);
    return this.prisma.comment.create({
      data: {
        issueId: id,
        authorId,
        body: dto.body,
        parentId: dto.parentId,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });
  }

  async addWatcher(id: string, companyId: string, userId: string) {
    await this.findOne(id, companyId);
    return this.prisma.issueWatcher.upsert({
      where: { issueId_userId: { issueId: id, userId } },
      create: { issueId: id, userId },
      update: {},
    });
  }

  async removeWatcher(id: string, companyId: string, userId: string) {
    await this.findOne(id, companyId);
    await this.prisma.issueWatcher.delete({
      where: { issueId_userId: { issueId: id, userId } },
    });
    return { message: 'Watcher removed' };
  }
}
