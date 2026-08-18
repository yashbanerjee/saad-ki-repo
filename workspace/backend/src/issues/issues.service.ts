import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { IssueStatus, Prisma } from '@prisma/client';
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
import {
  BoardColumnDef,
  DEFAULT_BOARD_COLUMNS,
  buildIssueUpdateForColumn,
  mergeSettingsWithColumns,
  newColumnId,
  parseBoardColumns,
  resolveIssueBoardColumnId,
} from './board-columns';
import {
  CREATOR_KIND_LABEL,
  creatorKindFromRoleSlugs,
  readCreatorKind,
  withCreatorKind,
} from './creator-kind';
import {
  assertCanChangeTaskStatus,
  assertCanDeleteIssue,
  assertCanFullyEditIssue,
  canDeleteIssue,
  isPrivilegedProjectUser,
} from '../common/project-access';
import { AuthenticatedUser } from '../common/decorators';

function mapPriority(p: string): 'low' | 'medium' | 'high' {
  if (['LOWEST', 'LOW'].includes(p)) return 'low';
  if (['HIGH', 'HIGHEST', 'CRITICAL'].includes(p)) return 'high';
  return 'medium';
}

async function resolveReporterCreatorKind(
  prisma: PrismaService,
  reporterId: string,
): Promise<import('./creator-kind').CreatorKind> {
  const user = await prisma.user.findUnique({
    where: { id: reporterId },
    select: {
      roles: { select: { role: { select: { slug: true } } } },
      linkedClient: { select: { id: true } },
    },
  });
  if (!user) return 'other';
  if (user.linkedClient) return 'client';
  const slugs = user.roles.map((r) => r.role.slug);
  return creatorKindFromRoleSlugs(slugs);
}

@Injectable()
export class IssuesService {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private storage: StorageService,
  ) {}

  async findAll(
    companyId: string,
    filters: IssueFilterDto,
    page = 1,
    limit = 20,
    user?: AuthenticatedUser,
  ) {
    const { skip, take } = paginate(page, limit);
    const privileged = user ? isPrivilegedProjectUser(user) : true;
    const where: Prisma.IssueWhereInput = {
      project: {
        companyId,
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(!privileged && user
          ? {
              OR: [
                { members: { some: { userId: user.id } } },
                { client: { userId: user.id } },
              ],
            }
          : {}),
      },
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.milestoneId ? { milestoneId: filters.milestoneId } : {}),
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
          project: {
            select: {
              id: true,
              key: true,
              name: true,
              clientId: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.issue.count({ where }),
    ]);
    const mapped = data.map((issue) => ({
      ...issue,
      canDelete: !user || canDeleteIssue(user, issue.reporterId),
    }));
    return paginatedResponse(mapped, total, page, limit);
  }

  private async resolveDefaultAssigneeId(projectId: string): Promise<string | null> {
    const owner = await this.prisma.projectMember.findFirst({
      where: { projectId, role: 'owner' },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    });
    if (owner) return owner.userId;

    const adminMember = await this.prisma.projectMember.findFirst({
      where: {
        projectId,
        user: {
          roles: {
            some: {
              role: {
                slug: { in: ['company_admin', 'super_admin', 'project_manager'] },
              },
            },
          },
        },
      },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    });
    return adminMember?.userId ?? null;
  }

  private async assertProjectAccess(
    projectId: string,
    companyId: string,
    user: AuthenticatedUser,
  ) {
    if (isPrivilegedProjectUser(user)) {
      const exists = await this.prisma.project.findFirst({
        where: { id: projectId, companyId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Project not found');
      return;
    }
    const member = await this.prisma.projectMember.findFirst({
      where: { projectId, userId: user.id, project: { companyId } },
      select: { id: true },
    });
    if (member) return;

    const asClient = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        companyId,
        client: { userId: user.id },
      },
      select: { id: true },
    });
    if (asClient) return;

    throw new ForbiddenException('You do not have access to this project');
  }

  async findOne(id: string, companyId: string, user?: AuthenticatedUser) {
    const issue = await this.prisma.issue.findFirst({
      where: { id, project: { companyId } },
      include: {
        assignee: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            linkedClient: { select: { id: true } },
            roles: { select: { role: { select: { slug: true } } } },
          },
        },
        project: {
          select: {
            id: true,
            key: true,
            name: true,
            settings: true,
            clientId: true,
            client: { select: { id: true, name: true, email: true } },
          },
        },
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
        milestone: { select: { id: true, name: true, status: true } },
        timeEntries: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });
    if (!issue) throw new NotFoundException('Issue not found');

    if (user) {
      await this.assertProjectAccess(issue.projectId, companyId, user);
    }

    const boardColumns = parseBoardColumns(issue.project.settings);
    const boardColumnId = resolveIssueBoardColumnId(issue, boardColumns);
    const creatorKind =
      readCreatorKind(issue.metadata) ||
      (issue.reporter?.linkedClient
        ? 'client'
        : creatorKindFromRoleSlugs(
            issue.reporter?.roles?.map((r) => r.role.slug) || [],
          ));

    const canEditStatus =
      !user ||
      isPrivilegedProjectUser(user) ||
      issue.assigneeId === user.id;
    const canFullyEdit = !user || isPrivilegedProjectUser(user);
    const canDelete = !user || canDeleteIssue(user, issue.reporterId);

    return {
      ...issue,
      boardColumnId,
      boardColumns,
      creatorKind,
      creatorLabel: CREATOR_KIND_LABEL[creatorKind],
      canEditStatus,
      canFullyEdit,
      canDelete,
    };
  }

  async getBoard(projectId: string, companyId: string, user?: AuthenticatedUser) {
    if (user) {
      await this.assertProjectAccess(projectId, companyId, user);
    }

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true, name: true, key: true, settings: true, avatar: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const boardColumns = parseBoardColumns(project.settings);
    const privileged = user ? isPrivilegedProjectUser(user) : true;

    const issues = await this.prisma.issue.findMany({
      where: {
        projectId,
        status: { notIn: [IssueStatus.CANCELLED] },
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            linkedClient: { select: { id: true } },
            roles: { select: { role: { select: { slug: true } } } },
          },
        },
        labels: { include: { label: { select: { name: true, color: true } } } },
        milestone: { select: { id: true, name: true } },
      },
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
    });

    const toTask = (i: (typeof issues)[number]) => {
      const boardColumn = resolveIssueBoardColumnId(i, boardColumns);
      const kind =
        readCreatorKind(i.metadata) ||
        (i.reporter?.linkedClient
          ? 'client'
          : creatorKindFromRoleSlugs(
              i.reporter?.roles?.map((r) => r.role.slug) || [],
            ));
      const canEditStatus =
        privileged || (Boolean(user) && i.assigneeId === user!.id);
      const canDelete = !user || canDeleteIssue(user, i.reporterId);
      return {
        id: i.id,
        key: i.key,
        title: i.title,
        priority: mapPriority(i.priority),
        status: i.status,
        boardColumn,
        type: i.type,
        milestoneId: i.milestoneId,
        milestoneName: i.milestone?.name,
        estimatedHours: i.estimatedHours,
        loggedHours: i.loggedHours,
        assigneeId: i.assigneeId,
        reporterId: i.reporterId,
        assignee: i.assignee
          ? `${i.assignee.firstName} ${i.assignee.lastName}`.trim()
          : undefined,
        reporter: i.reporter
          ? `${i.reporter.firstName} ${i.reporter.lastName}`.trim()
          : undefined,
        creatorKind: kind,
        creatorLabel: CREATOR_KIND_LABEL[kind],
        labels: i.labels.map((l) => l.label.name),
        dueDate: i.dueDate ? i.dueDate.toISOString().slice(0, 10) : undefined,
        canEditStatus,
        canDelete,
      };
    };

    const mapped = issues.map(toTask);

    const columns = boardColumns.map((col) => ({
      id: col.id,
      title: col.title,
      order: col.order,
      tasks: mapped.filter((i) => i.boardColumn === col.id),
      canDelete: boardColumns.length > 1,
    }));

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        sortOrder: true,
        _count: { select: { issues: true } },
      },
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        key: project.key,
        avatar: project.avatar,
      },
      columns,
      boardColumns,
      milestones,
      issues: mapped,
      canManageColumns: privileged,
    };
  }

  private async loadProjectColumns(projectId: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId },
      select: { id: true, settings: true },
    });
    if (!project) throw new NotFoundException('Project not found');
    return {
      project,
      columns: parseBoardColumns(project.settings),
    };
  }

  async addBoardColumn(projectId: string, companyId: string, title: string) {
    const name = title?.trim();
    if (!name) throw new BadRequestException('Column name is required');
    if (name.length > 60) throw new BadRequestException('Column name is too long');

    const { project, columns } = await this.loadProjectColumns(projectId, companyId);
    if (columns.length >= 20) {
      throw new BadRequestException('Maximum 20 columns per board');
    }

    const col: BoardColumnDef = {
      id: newColumnId(),
      title: name,
      order: columns.length,
    };
    const next = [...columns, col];
    await this.prisma.project.update({
      where: { id: project.id },
      data: { settings: mergeSettingsWithColumns(project.settings, next) },
    });
    return col;
  }

  async renameBoardColumn(
    projectId: string,
    companyId: string,
    columnId: string,
    title: string,
  ) {
    const name = title?.trim();
    if (!name) throw new BadRequestException('Column name is required');
    if (name.length > 60) throw new BadRequestException('Column name is too long');

    const { project, columns } = await this.loadProjectColumns(projectId, companyId);
    const idx = columns.findIndex((c) => c.id === columnId);
    if (idx < 0) throw new NotFoundException('Column not found');

    columns[idx] = { ...columns[idx], title: name };
    await this.prisma.project.update({
      where: { id: project.id },
      data: { settings: mergeSettingsWithColumns(project.settings, columns) },
    });
    return columns[idx];
  }

  async deleteBoardColumn(
    projectId: string,
    companyId: string,
    columnId: string,
    moveToColumnId?: string,
  ) {
    const { project, columns } = await this.loadProjectColumns(projectId, companyId);
    if (columns.length <= 1) {
      throw new BadRequestException('Cannot delete the last column');
    }
    const target = columns.find((c) => c.id === columnId);
    if (!target) throw new NotFoundException('Column not found');

    const remaining = columns.filter((c) => c.id !== columnId);
    const destId =
      (moveToColumnId && remaining.some((c) => c.id === moveToColumnId)
        ? moveToColumnId
        : remaining[0]?.id) || DEFAULT_BOARD_COLUMNS[0].id;

    // Reassign issues currently on this column
    const issues = await this.prisma.issue.findMany({
      where: { projectId, status: { not: IssueStatus.CANCELLED } },
      select: { id: true, status: true, metadata: true },
    });

    for (const issue of issues) {
      const col = resolveIssueBoardColumnId(issue, columns);
      if (col !== columnId) continue;
      const update = buildIssueUpdateForColumn(destId, issue.metadata);
      await this.prisma.issue.update({
        where: { id: issue.id },
        data: {
          status: update.status,
          metadata: update.metadata,
          resolvedAt: update.status === IssueStatus.DONE ? new Date() : null,
          closedAt: update.status === IssueStatus.DONE ? new Date() : null,
        },
      });
    }

    const next = remaining.map((c, i) => ({ ...c, order: i }));
    await this.prisma.project.update({
      where: { id: project.id },
      data: { settings: mergeSettingsWithColumns(project.settings, next) },
    });

    return { message: 'Column deleted', movedTo: destId, columns: next };
  }

  async create(
    companyId: string,
    reporterId: string,
    dto: CreateIssueDto,
    user?: AuthenticatedUser,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, companyId },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (user) {
      await this.assertProjectAccess(dto.projectId, companyId, user);
    }

    if (dto.milestoneId) {
      const ms = await this.prisma.milestone.findFirst({
        where: { id: dto.milestoneId, projectId: dto.projectId },
      });
      if (!ms) throw new BadRequestException('Milestone not found on this project');
    }

    const boardColumns = parseBoardColumns(project.settings);
    const requestedColumn = (dto.status || IssueStatus.TODO).trim();
    const column =
      boardColumns.find((c) => c.id === requestedColumn) ||
      boardColumns.find((c) => c.id === IssueStatus.TODO) ||
      boardColumns[0];
    if (!column) throw new BadRequestException('No board columns configured');
    const columnPlacement = buildIssueUpdateForColumn(column.id, {});
    const creatorKind = await resolveReporterCreatorKind(this.prisma, reporterId);
    const metadata = withCreatorKind(columnPlacement.metadata, creatorKind);

    const lastIssue = await this.prisma.issue.findFirst({
      where: { projectId: dto.projectId },
      orderBy: { number: 'desc' },
    });
    const number = (lastIssue?.number ?? 0) + 1;
    const key = `${project.key}-${number}`;

    // Default: assign to project owner (admin / Vedha). Non-admins cannot pick assignees.
    let assigneeId: string | null | undefined = dto.assigneeId;
    if (user && !isPrivilegedProjectUser(user)) {
      assigneeId = await this.resolveDefaultAssigneeId(dto.projectId);
    } else if (!assigneeId) {
      assigneeId = await this.resolveDefaultAssigneeId(dto.projectId);
    }

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
        assigneeId: assigneeId || undefined,
        reporterId,
        sprintId: dto.sprintId,
        milestoneId: dto.milestoneId || undefined,
        parentId: dto.parentId,
        storyPoints: dto.storyPoints,
        estimatedHours: dto.estimatedHours,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: columnPlacement.status,
        metadata: metadata as never,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { key: true } },
        milestone: { select: { id: true, name: true } },
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

  async update(
    id: string,
    companyId: string,
    userId: string,
    dto: UpdateIssueDto,
    user?: AuthenticatedUser,
  ) {
    const existing = await this.findOne(id, companyId, user);
    if (user) {
      assertCanFullyEditIssue(user, existing.assigneeId);
    }

    if (dto.milestoneId) {
      const ms = await this.prisma.milestone.findFirst({
        where: { id: dto.milestoneId, projectId: existing.projectId },
      });
      if (!ms) throw new BadRequestException('Milestone not found on this project');
    }

    const issue = await this.prisma.issue.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
        ...(dto.sprintId !== undefined ? { sprintId: dto.sprintId } : {}),
        ...(dto.milestoneId !== undefined
          ? { milestoneId: dto.milestoneId || null }
          : {}),
        ...(dto.storyPoints !== undefined ? { storyPoints: dto.storyPoints } : {}),
        ...(dto.estimatedHours !== undefined
          ? { estimatedHours: dto.estimatedHours }
          : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
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

  async transition(
    id: string,
    companyId: string,
    userId: string,
    dto: TransitionIssueDto,
    user?: AuthenticatedUser,
  ) {
    const existing = await this.findOne(id, companyId, user);
    if (user) {
      assertCanChangeTaskStatus(user, existing.assigneeId);
    }
    // status field is enum — for board custom columns use updateBoardTaskStatus
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
    user: AuthenticatedUser,
    columnId: string,
  ) {
    await this.assertProjectAccess(projectId, companyId, user);

    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId, project: { companyId } },
    });
    if (!issue) throw new NotFoundException('Task not found');

    assertCanChangeTaskStatus(user, issue.assigneeId);

    const { columns } = await this.loadProjectColumns(projectId, companyId);
    const col = columns.find((c) => c.id === columnId);
    if (!col) {
      throw new BadRequestException(`Unknown board column: ${columnId}`);
    }

    const update = buildIssueUpdateForColumn(columnId, issue.metadata);
    const updated = await this.prisma.issue.update({
      where: { id: taskId },
      data: {
        status: update.status,
        metadata: update.metadata,
        resolvedAt: update.status === IssueStatus.DONE ? new Date() : null,
        closedAt: update.status === IssueStatus.DONE ? new Date() : null,
      },
    });

    await this.activity.log({
      companyId,
      userId: user.id,
      projectId,
      entityType: 'Issue',
      entityId: taskId,
      action: 'status_changed',
      message: `${issue.key} moved to column "${col.title}"`,
      metadata: { from: issue.status, to: columnId, columnTitle: col.title },
    });

    return updated;
  }

  async remove(id: string, companyId: string, user: AuthenticatedUser) {
    const issue = await this.prisma.issue.findFirst({
      where: { id, project: { companyId } },
      select: { id: true, reporterId: true, projectId: true },
    });
    if (!issue) throw new NotFoundException('Issue not found');
    await this.assertProjectAccess(issue.projectId, companyId, user);
    assertCanDeleteIssue(user, issue.reporterId);
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

  async listTimeEntries(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.timeEntry.findMany({
      where: { issueId: id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async addTimeEntry(
    id: string,
    companyId: string,
    userId: string,
    dto: { hours: number; description?: string; date?: string },
  ) {
    const issue = await this.findOne(id, companyId);
    const hours = Number(dto.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new BadRequestException('Hours must be a positive number');
    }
    if (hours > 24) {
      throw new BadRequestException('Hours must be 24 or less per entry');
    }

    const entry = await this.prisma.timeEntry.create({
      data: {
        issueId: id,
        userId,
        hours,
        description: dto.description?.trim() || undefined,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.prisma.issue.update({
      where: { id },
      data: { loggedHours: { increment: hours } },
    });

    await this.activity.log({
      companyId,
      userId,
      projectId: issue.projectId,
      entityType: 'Issue',
      entityId: id,
      action: 'time_logged',
      message: `Logged ${hours}h on ${issue.key}`,
    });

    return entry;
  }

  async removeTimeEntry(issueId: string, entryId: string, companyId: string) {
    await this.findOne(issueId, companyId);
    const entry = await this.prisma.timeEntry.findFirst({
      where: { id: entryId, issueId },
    });
    if (!entry) throw new NotFoundException('Time entry not found');

    await this.prisma.timeEntry.delete({ where: { id: entryId } });
    await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        loggedHours: {
          decrement: entry.hours,
        },
      },
    });
    // Avoid negative accumulated hours
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { loggedHours: true },
    });
    if (issue && issue.loggedHours < 0) {
      await this.prisma.issue.update({
        where: { id: issueId },
        data: { loggedHours: 0 },
      });
    }
    return { message: 'Time entry deleted' };
  }
}
