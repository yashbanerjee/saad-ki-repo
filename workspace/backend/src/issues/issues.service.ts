import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IssueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateIssueDto,
  UpdateIssueDto,
  TransitionIssueDto,
  CreateCommentDto,
  IssueFilterDto,
} from './dto/issue.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { ActivityService } from '../activity/activity.service';

const ADMIN_BOARD_STATUSES: { status: IssueStatus; title: string }[] = [
  { status: IssueStatus.TODO, title: 'To Do' },
  { status: IssueStatus.IN_PROGRESS, title: 'In Progress' },
  { status: IssueStatus.TESTING, title: 'Testing' },
  { status: IssueStatus.CODE_REVIEW, title: 'Code Review' },
  { status: IssueStatus.READY_FOR_QA, title: 'Ready for QA' },
  { status: IssueStatus.QA_FAILED, title: 'QA Failed' },
  { status: IssueStatus.READY_FOR_RELEASE, title: 'Ready for Release' },
  { status: IssueStatus.DONE, title: 'Done' },
  { status: IssueStatus.BLOCKED, title: 'Blocked' },
];

const CLIENT_BOARD_STATUSES: { status: IssueStatus; title: string }[] = [
  { status: IssueStatus.TODO, title: 'To Do' },
  { status: IssueStatus.IN_PROGRESS, title: 'In Progress' },
  { status: IssueStatus.TESTING, title: 'Testing' },
  { status: IssueStatus.DONE, title: 'Done' },
];

function mapPriority(p: string): 'low' | 'medium' | 'high' {
  if (['LOWEST', 'LOW'].includes(p)) return 'low';
  if (['HIGH', 'HIGHEST', 'CRITICAL'].includes(p)) return 'high';
  return 'medium';
}

@Injectable()
export class IssuesService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private storage: StorageService,
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
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, key: true, name: true } },
        sprint: true,
        comments: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        labels: { include: { label: true } },
        watchers: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        children: { select: { id: true, key: true, title: true, status: true, type: true } },
      },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  async getBoard(projectId: string, companyId: string, isClient = false) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true, name: true, key: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const issues = await this.prisma.issue.findMany({
      where: {
        projectId,
        status: { notIn: [IssueStatus.CANCELLED] },
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        labels: { include: { label: { select: { name: true, color: true } } } },
      },
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
    });

    const defs = isClient ? CLIENT_BOARD_STATUSES : ADMIN_BOARD_STATUSES;
    const known = new Set(defs.map((d) => d.status));

    const toTask = (i: (typeof issues)[number]) => ({
      id: i.id,
      key: i.key,
      title: i.title,
      priority: mapPriority(i.priority),
      status: i.status,
      type: i.type,
      assignee: i.assignee
        ? `${i.assignee.firstName} ${i.assignee.lastName}`.trim()
        : undefined,
      labels: i.labels.map((l) => l.label.name),
      dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : undefined,
    });

    const columns = defs.map((col) => ({
      id: col.status,
      title: col.title,
      tasks: issues.filter((i) => i.status === col.status).map(toTask),
    }));

    const orphans = issues.filter((i) => !known.has(i.status));
    if (orphans.length && isClient) {
      const todo = columns.find((c) => c.id === IssueStatus.TODO);
      if (todo) {
        todo.tasks.push(...orphans.map(toTask));
      }
    }

    return { project, columns };
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
        type: dto.type ?? 'TASK',
        priority: dto.priority ?? 'MEDIUM',
        severity: dto.severity,
        assigneeId: dto.assigneeId,
        reporterId,
        sprintId: dto.sprintId,
        parentId: dto.parentId,
        storyPoints: dto.storyPoints,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status ?? IssueStatus.TODO,
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

  async updateBoardTaskStatus(
    projectId: string,
    taskId: string,
    companyId: string,
    userId: string,
    status: string,
  ) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId, project: { companyId } },
    });
    if (!issue) throw new NotFoundException('Task not found');

    const normalized = status.toUpperCase().replace(/-/g, '_') as IssueStatus;
    if (!Object.values(IssueStatus).includes(normalized)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    return this.transition(taskId, companyId, userId, { status: normalized });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.issue.delete({ where: { id } });
    return { message: 'Issue deleted' };
  }

  async addComment(id: string, companyId: string, authorId: string, dto: CreateCommentDto) {
    await this.findOne(id, companyId);
    return this.prisma.comment.create({
      data: {
        issueId: id,
        authorId,
        body: dto.body,
        parentId: dto.parentId,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });
  }

  async addAttachment(
    id: string,
    companyId: string,
    uploadedById: string,
    file: Express.Multer.File,
  ) {
    await this.findOne(id, companyId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Please choose a file to upload');
    }

    const key = this.storage.generateKey(`issues/${id}`, file.originalname);
    const { url } = await this.storage.upload(key, file.buffer, file.mimetype);

    return this.prisma.attachment.create({
      data: {
        issueId: id,
        uploadedById,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey: key,
        storageUrl: url,
      },
      include: {
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deleteAttachment(issueId: string, attachmentId: string, companyId: string) {
    await this.findOne(issueId, companyId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, issueId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    try {
      await this.storage.delete(attachment.storageKey);
    } catch {
      /* ignore */
    }
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    return { message: 'Attachment deleted' };
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
