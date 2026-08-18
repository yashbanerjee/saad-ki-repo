import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { IssueStatus, IssueType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  CreateClientTaskDto,
  UpdateClientTaskDto,
} from './dto/project.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import {
  parseBoardColumns,
  resolveIssueBoardColumnId,
  buildIssueUpdateForColumn,
} from '../issues/board-columns';
import {
  CREATOR_KIND_LABEL,
  creatorKindFromRoleSlugs,
  readCreatorKind,
  withCreatorKind,
} from '../issues/creator-kind';
import { isPrivilegedProjectUser } from '../common/project-access';
import { AuthenticatedUser } from '../common/decorators';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  private computeProgress(tasks: { status: string }[]) {
    if (!tasks.length) return 0;
    const done = tasks.filter((t) => t.status === 'DONE').length;
    return Math.round((done / tasks.length) * 1000) / 10;
  }

  private progressPayload(
    milestones: { status: string }[],
    tasks: { status: string }[],
  ) {
    const progressPercent = this.computeProgress(tasks);
    const milestoneCounts = {
      total: milestones.length,
      done: milestones.filter((m) => m.status === 'DONE').length,
      inProgress: milestones.filter((m) => m.status === 'IN_PROGRESS').length,
      planned: milestones.filter((m) => m.status === 'PLANNED').length,
    };
    const taskCounts = {
      total: tasks.length,
      done: tasks.filter((t) => t.status === 'DONE').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      todo: tasks.filter((t) => t.status === 'TODO').length,
    };
    return { progressPercent, milestoneCounts, taskCounts };
  }

  /** Projects linked to the logged-in client's CRM record */
  async findForClientUser(userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { userId },
      select: { id: true, name: true },
    });
    if (!client) return [];

    const projects = await this.prisma.project.findMany({
      where: { clientId: client.id, status: { not: 'ARCHIVED' } },
      orderBy: { updatedAt: 'desc' },
      include: {
        clientTasks: { select: { status: true } },
        milestones: { select: { status: true } },
      },
    });

    return projects.map(({ clientTasks, milestones, ...p }) => ({
      ...p,
      clientName: client.name,
      ...this.progressPayload(milestones, clientTasks),
      portalUrl:
        p.portalEnabled && p.portalToken ? `/portal/${p.portalToken}` : null,
    }));
  }

  async findAll(
    companyId: string,
    page = 1,
    limit = 20,
    status?: string,
    tag?: string,
    user?: AuthenticatedUser,
  ) {
    const { skip, take } = paginate(page, limit);
    const tagFilter = tag?.trim();
    const privileged = user ? isPrivilegedProjectUser(user) : true;
    const where: Prisma.ProjectWhereInput = {
      companyId,
      ...(status ? { status: status as never } : {}),
      ...(tagFilter
        ? {
            tags: {
              has: tagFilter,
            },
          }
        : {}),
      ...(!privileged && user
        ? {
            OR: [
              { members: { some: { userId: user.id } } },
              { client: { userId: user.id } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true, issues: true, clientTasks: true } },
          clientTasks: { select: { status: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);

    const mapped = data.map(({ clientTasks, ...p }) => ({
      ...p,
      progressPercent: this.computeProgress(clientTasks),
    }));

    return paginatedResponse(mapped, total, page, limit);
  }

  /** Distinct tags used across company projects (for filters / suggestions) */
  async listTags(companyId: string) {
    const rows = await this.prisma.project.findMany({
      where: { companyId },
      select: { tags: true },
    });
    const set = new Set<string>();
    for (const row of rows) {
      for (const t of row.tags || []) {
        if (t?.trim()) set.add(t.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  async assertUserCanAccessProject(
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

    // Linked CRM client may view their own projects
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

  /** Default assignee: project owner (admin / Vedha), else first privileged member. */
  async resolveDefaultAssigneeId(projectId: string): Promise<string | null> {
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

  async findOne(id: string, companyId: string, user?: AuthenticatedUser) {
    if (user) {
      await this.assertUserCanAccessProject(id, companyId, user);
    }
    const project = await this.prisma.project.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                roles: {
                  select: { role: { select: { slug: true, name: true } } },
                },
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        milestones: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            _count: { select: { issues: true, clientTasks: true } },
          },
        },
        clientTasks: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { milestone: { select: { id: true, name: true } } },
        },
        issues: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
          take: 200,
          select: {
            id: true,
            key: true,
            title: true,
            status: true,
            priority: true,
            type: true,
            milestoneId: true,
            estimatedHours: true,
            loggedHours: true,
            dueDate: true,
            assigneeId: true,
            assignee: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            name: true,
            originalName: true,
            mimeType: true,
            size: true,
            storageUrl: true,
            isClientVisible: true,
            type: true,
            createdAt: true,
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: {
            issues: true,
            sprints: true,
            clientTasks: true,
            milestones: true,
            documents: true,
          },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const progress = this.progressPayload(project.milestones, project.clientTasks);
    // Prefer issue-based progress when board tasks exist
    let progressPercent = progress.progressPercent;
    if (project.issues.length) {
      const done = project.issues.filter((i) => i.status === 'DONE').length;
      progressPercent = Math.round((done / project.issues.length) * 100);
    }
    return { ...project, ...progress, progressPercent };
  }

  async create(companyId: string, userId: string, dto: CreateProjectDto) {
    const baseKey = (dto.key || dto.name)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 6);
    let key = baseKey.length >= 2 ? baseKey : 'PRJ';
    let suffix = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const candidate = suffix === 0 ? key : `${key}${suffix}`;
      const existing = await this.prisma.project.findFirst({
        where: { companyId, key: candidate },
      });
      if (!existing) {
        key = candidate;
        break;
      }
      suffix += 1;
      if (suffix > 99) {
        key = `P${Date.now().toString().slice(-5)}`;
        break;
      }
    }

    return this.prisma.project.create({
      data: {
        companyId,
        key,
        name: dto.name,
        description: dto.description,
        clientId: dto.clientId,
        tags: dto.tags ?? [],
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        members: { create: { userId, role: 'owner' } },
      },
      include: {
        members: true,
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateProjectDto) {
    await this.findOne(id, companyId);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.clientId !== undefined ? { clientId: dto.clientId || null } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        ...(dto.avatar !== undefined ? { avatar: dto.avatar || null } : {}),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async uploadLogo(
    id: string,
    companyId: string,
    file: Express.Multer.File,
  ) {
    await this.findOne(id, companyId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Please choose a logo image');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!mime.startsWith('image/')) {
      throw new BadRequestException('Logo must be an image (PNG, JPG, WebP, or SVG)');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Logo must be 5 MB or smaller');
    }

    const key = this.storage.generateKey(
      `companies/${companyId}/projects/${id}/logo`,
      file.originalname || 'logo.png',
    );
    const { url } = await this.storage.upload(
      key,
      file.buffer,
      file.mimetype || 'image/png',
    );
    const avatar = url || key;

    return this.prisma.project.update({
      where: { id },
      data: { avatar },
      select: {
        id: true,
        name: true,
        avatar: true,
      },
    });
  }

  async archive(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.project.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.$transaction(async (tx) => {
      await tx.issue.updateMany({ where: { projectId: id }, data: { parentId: null } });
      await tx.invoice.updateMany({
        where: { projectId: id },
        data: { projectId: null, milestoneId: null },
      });
      await tx.document.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.activityLog.updateMany({ where: { projectId: id }, data: { projectId: null } });
      await tx.project.delete({ where: { id } });
    });
    return { deleted: true };
  }

  async addMember(id: string, companyId: string, dto: AddProjectMemberDto) {
    await this.findOne(id, companyId);
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('User not found in this company');

    const role = (dto.role?.trim() || 'developer').toLowerCase();
    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: dto.userId } },
      create: { projectId: id, userId: dto.userId, role },
      update: { role },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
  }

  async removeMember(id: string, companyId: string, userId: string) {
    await this.findOne(id, companyId);
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') {
      throw new BadRequestException('Cannot remove the project owner');
    }
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId } },
    });
    return { message: 'Member removed' };
  }

  // ── Portal ──────────────────────────────────────────────

  async enablePortal(id: string, companyId: string) {
    const project = await this.findOne(id, companyId);
    const token = project.portalToken || randomBytes(24).toString('hex');
    return this.prisma.project.update({
      where: { id },
      data: { portalEnabled: true, portalToken: token },
      select: {
        id: true,
        name: true,
        portalToken: true,
        portalEnabled: true,
      },
    });
  }

  async rotatePortal(id: string, companyId: string) {
    await this.findOne(id, companyId);
    const token = randomBytes(24).toString('hex');
    return this.prisma.project.update({
      where: { id },
      data: { portalToken: token, portalEnabled: true },
      select: {
        id: true,
        name: true,
        portalToken: true,
        portalEnabled: true,
      },
    });
  }

  async disablePortal(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.project.update({
      where: { id },
      data: { portalEnabled: false },
      select: {
        id: true,
        name: true,
        portalToken: true,
        portalEnabled: true,
      },
    });
  }

  async getPublicPortal(token: string) {
    const project = await this.prisma.project.findFirst({
      where: { portalToken: token, portalEnabled: true },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
        avatar: true,
        settings: true,
        client: { select: { id: true, name: true, companyName: true } },
        milestones: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            description: true,
            dueDate: true,
            status: true,
            sortOrder: true,
          },
        },
        clientTasks: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            estimatedHours: true,
            milestoneId: true,
            sortOrder: true,
            milestone: { select: { id: true, name: true } },
          },
        },
        issues: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
          take: 200,
          select: {
            id: true,
            key: true,
            title: true,
            description: true,
            type: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            metadata: true,
            loggedHours: true,
            estimatedHours: true,
            milestone: { select: { id: true, name: true } },
            reporter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                linkedClient: { select: { id: true } },
                roles: { select: { role: { select: { slug: true } } } },
              },
            },
          },
        },
        documents: {
          where: { isClientVisible: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            name: true,
            originalName: true,
            mimeType: true,
            size: true,
            storageUrl: true,
            type: true,
            createdAt: true,
            storageKey: true,
            metadata: true,
          },
        },
        company: { select: { name: true } },
      },
    });
    if (!project) throw new NotFoundException('Portal not found or disabled');

    // Use same project board columns as the signed-in board (custom columns supported)
    const boardColumns = parseBoardColumns(project.settings);
    const doneColumnIds = new Set(
      boardColumns
        .filter(
          (c) =>
            c.id === IssueStatus.DONE ||
            c.id === 'DONE' ||
            /^done$/i.test(c.title.trim()),
        )
        .map((c) => c.id),
    );
    if (!doneColumnIds.size) doneColumnIds.add(IssueStatus.DONE);

    const isIssueDone = (issue: (typeof project.issues)[number]) => {
      if (issue.status === IssueStatus.DONE) return true;
      const col = resolveIssueBoardColumnId(issue, boardColumns);
      return doneColumnIds.has(col);
    };

    // Progress from Kanban board tasks (primary). Fallback: client tasks, then milestones.
    let progressPercent = 0;
    if (project.issues.length) {
      const done = project.issues.filter(isIssueDone).length;
      progressPercent = Math.round((done / project.issues.length) * 100);
    } else if (project.clientTasks.length) {
      progressPercent = Math.round(this.computeProgress(project.clientTasks));
    } else if (project.milestones.length) {
      progressPercent = Math.round(this.computeProgress(project.milestones));
    }

    const progressMeta = this.progressPayload(project.milestones, project.clientTasks);

    const totalLoggedHours = Math.round(
      project.issues.reduce((sum, i) => sum + (i.loggedHours || 0), 0) * 10,
    ) / 10;
    const totalEstimatedHours = Math.round(
      project.issues.reduce((sum, i) => sum + (i.estimatedHours || 0), 0) * 10,
    ) / 10;

    const now = Date.now();
    const endMs = project.endDate ? new Date(project.endDate).getTime() : null;
    const daysRemaining =
      endMs != null ? Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)) : null;

    const issueCounts = {
      total: project.issues.length,
      done: project.issues.filter(isIssueDone).length,
      inProgress: project.issues.filter((i) => {
        if (isIssueDone(i)) return false;
        const col = resolveIssueBoardColumnId(i, boardColumns);
        return (
          col === IssueStatus.IN_PROGRESS ||
          col === IssueStatus.TESTING ||
          i.status === IssueStatus.IN_PROGRESS ||
          [
            'TESTING',
            'CODE_REVIEW',
            'READY_FOR_QA',
            'READY_FOR_RELEASE',
            'BLOCKED',
          ].includes(i.status)
        );
      }).length,
      todo: project.issues.filter((i) => {
        if (isIssueDone(i)) return false;
        const col = resolveIssueBoardColumnId(i, boardColumns);
        return col === IssueStatus.TODO || i.status === IssueStatus.TODO;
      }).length,
      testing: project.issues.filter((i) => {
        const col = resolveIssueBoardColumnId(i, boardColumns);
        return col === IssueStatus.TESTING || i.status === IssueStatus.TESTING;
      }).length,
      blocked: project.issues.filter((i) => i.status === 'BLOCKED').length,
    };

    const columns = boardColumns.map((col) => ({
      id: col.id,
      title: col.title,
      tasks: project.issues
        .filter((issue) => resolveIssueBoardColumnId(issue, boardColumns) === col.id)
        .map((issue) => {
          const kind =
            readCreatorKind(issue.metadata) ||
            (issue.reporter?.linkedClient
              ? 'client'
              : creatorKindFromRoleSlugs(
                  issue.reporter?.roles?.map((r) => r.role.slug) || [],
                ));
          return {
            id: issue.id,
            key: issue.key,
            title: issue.title,
            description: issue.description,
            type: issue.type,
            status: issue.status,
            priority: issue.priority,
            dueDate: issue.dueDate,
            createdAt: issue.createdAt,
            loggedHours: issue.loggedHours,
            estimatedHours: issue.estimatedHours,
            milestone: issue.milestone,
            creatorKind: kind,
            creatorLabel: CREATOR_KIND_LABEL[kind],
            reporter: issue.reporter
              ? `${issue.reporter.firstName} ${issue.reporter.lastName}`.trim()
              : undefined,
            canDelete: kind === 'client',
          };
        }),
    }));

    const mapIssueForMilestone = (issue: (typeof project.issues)[number]) => {
      const kind =
        readCreatorKind(issue.metadata) ||
        (issue.reporter?.linkedClient
          ? 'client'
          : creatorKindFromRoleSlugs(
              issue.reporter?.roles?.map((r) => r.role.slug) || [],
            ));
      return {
        id: issue.id,
        key: issue.key,
        title: issue.title,
        status: issue.status,
        done: isIssueDone(issue),
        priority: issue.priority,
        loggedHours: issue.loggedHours ?? 0,
        estimatedHours: issue.estimatedHours ?? null,
        creatorKind: kind,
        creatorLabel: CREATOR_KIND_LABEL[kind],
      };
    };

    const milestonesWithProgress = project.milestones.map((m) => {
      const assigned = project.issues
        .filter((i) => i.milestone?.id === m.id)
        .map(mapIssueForMilestone);
      const total = assigned.length;
      const done = assigned.filter((t) => t.done).length;
      const progressPercent =
        total > 0 ? Math.round((done / total) * 100) : m.status === 'DONE' ? 100 : 0;
      const loggedHours =
        Math.round(assigned.reduce((sum, t) => sum + (t.loggedHours || 0), 0) * 10) / 10;
      return {
        ...m,
        progressPercent,
        taskCount: total,
        doneTaskCount: done,
        loggedHours,
        tasks: assigned,
      };
    });

    return {
      projectName: project.name,
      projectKey: project.key,
      projectLogo: project.avatar || null,
      description: project.description,
      status: project.status,
      companyName: project.company.name,
      clientName: project.client?.name ?? project.client?.companyName ?? null,
      startDate: project.startDate,
      endDate: project.endDate,
      daysRemaining,
      milestones: milestonesWithProgress,
      tasks: project.clientTasks,
      issues: project.issues,
      issueCounts,
      columns,
      totalLoggedHours,
      totalEstimatedHours,
      documents: project.documents.map((d) => {
        const meta =
          d.metadata && typeof d.metadata === 'object'
            ? (d.metadata as Record<string, unknown>)
            : {};
        const fromClient =
          meta.portalClient === true ||
          String(d.storageKey || '').includes('/portal') ||
          String(d.storageKey || '').startsWith('portal-link/');
        return {
          ...d,
          metadata: undefined,
          storageKey: undefined,
          downloadable: true,
          fromClient,
        };
      }),
      ...progressMeta,
      progressPercent,
    };
  }

  // ── Milestones ──────────────────────────────────────────

  async listMilestones(projectId: string, companyId: string) {
    await this.findOne(projectId, companyId);
    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { clientTasks: true } } },
    });
  }

  async createMilestone(projectId: string, companyId: string, dto: CreateMilestoneDto) {
    await this.findOne(projectId, companyId);
    const status = dto.status ?? 'PLANNED';
    return this.prisma.milestone.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status,
        sortOrder: dto.sortOrder ?? 0,
        completedAt: status === 'DONE' ? new Date() : undefined,
      },
    });
  }

  async updateMilestone(
    projectId: string,
    milestoneId: string,
    companyId: string,
    dto: UpdateMilestoneDto,
  ) {
    await this.findOne(projectId, companyId);
    const existing = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!existing) throw new NotFoundException('Milestone not found');

    const status = dto.status ?? existing.status;
    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.dueDate !== undefined
          ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        completedAt:
          status === 'DONE'
            ? existing.completedAt ?? new Date()
            : dto.status && dto.status !== 'DONE'
              ? null
              : existing.completedAt,
      },
    });
  }

  async deleteMilestone(projectId: string, milestoneId: string, companyId: string) {
    await this.findOne(projectId, companyId);
    const existing = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
    });
    if (!existing) throw new NotFoundException('Milestone not found');
    await this.prisma.milestone.delete({ where: { id: milestoneId } });
    return { message: 'Milestone deleted' };
  }

  // ── Client tasks ────────────────────────────────────────

  async listClientTasks(projectId: string, companyId: string) {
    await this.findOne(projectId, companyId);
    return this.prisma.clientTask.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { milestone: { select: { id: true, name: true } } },
    });
  }

  async createClientTask(projectId: string, companyId: string, dto: CreateClientTaskDto) {
    await this.findOne(projectId, companyId);
    if (dto.milestoneId) {
      const ms = await this.prisma.milestone.findFirst({
        where: { id: dto.milestoneId, projectId },
      });
      if (!ms) throw new BadRequestException('Milestone not found on this project');
    }
    return this.prisma.clientTask.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        milestoneId: dto.milestoneId,
        status: dto.status ?? 'TODO',
        estimatedHours: dto.estimatedHours,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: { milestone: { select: { id: true, name: true } } },
    });
  }

  async updateClientTask(
    projectId: string,
    taskId: string,
    companyId: string,
    dto: UpdateClientTaskDto,
  ) {
    await this.findOne(projectId, companyId);
    const existing = await this.prisma.clientTask.findFirst({
      where: { id: taskId, projectId },
    });
    if (!existing) throw new NotFoundException('Client task not found');

    if (dto.milestoneId) {
      const ms = await this.prisma.milestone.findFirst({
        where: { id: dto.milestoneId, projectId },
      });
      if (!ms) throw new BadRequestException('Milestone not found on this project');
    }

    return this.prisma.clientTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.milestoneId !== undefined ? { milestoneId: dto.milestoneId || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.estimatedHours !== undefined ? { estimatedHours: dto.estimatedHours } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      include: { milestone: { select: { id: true, name: true } } },
    });
  }

  async deleteClientTask(projectId: string, taskId: string, companyId: string) {
    await this.findOne(projectId, companyId);
    const existing = await this.prisma.clientTask.findFirst({
      where: { id: taskId, projectId },
    });
    if (!existing) throw new NotFoundException('Client task not found');
    await this.prisma.clientTask.delete({ where: { id: taskId } });
    return { message: 'Client task deleted' };
  }

  // ── Public portal mutations (token-gated, no login) ─────

  private asMeta(metadata: unknown): Record<string, unknown> {
    if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
      return { ...(metadata as Record<string, unknown>) };
    }
    return {};
  }

  private idList(meta: Record<string, unknown>, key: string): string[] {
    return Array.isArray(meta[key])
      ? (meta[key] as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];
  }

  private isClientIssue(metadata: unknown): boolean {
    return readCreatorKind(metadata) === 'client';
  }

  private portalClientTaskId(metadata: unknown): string | null {
    const id = this.asMeta(metadata).portalClientTaskId;
    return typeof id === 'string' && id.trim() ? id : null;
  }

  private clientTaskStatusFromIssue(status: string): 'TODO' | 'IN_PROGRESS' | 'DONE' {
    if (status === IssueStatus.DONE) return 'DONE';
    if (status === IssueStatus.IN_PROGRESS) return 'IN_PROGRESS';
    return 'TODO';
  }

  private async findPortalClientTaskMirror(
    projectId: string,
    issue: { title?: string | null; description?: string | null; metadata?: unknown },
  ) {
    const linkedId = this.portalClientTaskId(issue.metadata);
    if (linkedId) {
      const linked = await this.prisma.clientTask.findFirst({
        where: { id: linkedId, projectId },
      });
      if (linked) return linked;
    }
    if (!issue.title) return null;
    return this.prisma.clientTask.findFirst({
      where: {
        projectId,
        title: issue.title,
        ...(issue.description ? { description: issue.description } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private isClientDocument(doc: { metadata?: unknown; storageKey?: string | null }) {
    const meta = this.asMeta(doc.metadata);
    return (
      meta.portalClient === true ||
      String(doc.storageKey || '').includes('/portal') ||
      String(doc.storageKey || '').startsWith('portal-link/')
    );
  }

  private async resolvePortalProject(token: string) {
    if (!token?.trim()) throw new NotFoundException('Portal not found or disabled');
    const project = await this.prisma.project.findFirst({
      where: { portalToken: token, portalEnabled: true },
      select: {
        id: true,
        key: true,
        companyId: true,
        clientId: true,
        members: {
          where: { role: 'owner' },
          take: 1,
          select: { userId: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Portal not found or disabled');

    let reporterId: string | undefined = project.members[0]?.userId;
    if (!reporterId) {
      const user = await this.prisma.user.findFirst({
        where: { companyId: project.companyId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      reporterId = user?.id;
    }
    if (!reporterId) {
      throw new BadRequestException('Project has no owner to attribute client actions');
    }

    return {
      projectId: project.id,
      companyId: project.companyId,
      clientId: project.clientId,
      projectKey: project.key,
      reporterId,
    };
  }

  async portalCreateMilestone(token: string, dto: CreateMilestoneDto) {
    const { projectId, companyId } = await this.resolvePortalProject(token);
    return this.createMilestone(projectId, companyId, dto);
  }

  /** Creates a board task (issue) visible on the public Kanban + optional client task. */
  async portalCreateTask(
    token: string,
    body: {
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      type?: string;
      milestoneId?: string;
    },
  ) {
    const { projectId, companyId, reporterId } = await this.resolvePortalProject(token);
    const title = body.title?.trim();
    if (!title) throw new BadRequestException('Title is required');

    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
      select: { key: true, settings: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const boardColumns = parseBoardColumns(project.settings);
    const requestedColumn = (body.status || IssueStatus.TODO).trim();
    const column =
      boardColumns.find((c) => c.id === requestedColumn) ||
      boardColumns.find((c) => c.id === IssueStatus.TODO) ||
      boardColumns[0];
    if (!column) throw new BadRequestException('No board columns configured');
    const placement = buildIssueUpdateForColumn(column.id, {});
    const metadata = withCreatorKind(placement.metadata, 'client');

    const allowedPriority = new Set(['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST', 'CRITICAL']);
    const priority = allowedPriority.has((body.priority || '').toUpperCase())
      ? (body.priority!.toUpperCase() as
          | 'LOWEST'
          | 'LOW'
          | 'MEDIUM'
          | 'HIGH'
          | 'HIGHEST'
          | 'CRITICAL')
      : 'MEDIUM';

    const allowedTypes = new Set(Object.values(IssueType));
    const requestedType = (body.type || 'TASK').toUpperCase();
    const type = allowedTypes.has(requestedType as IssueType)
      ? (requestedType as IssueType)
      : IssueType.TASK;

    if (body.milestoneId) {
      const ms = await this.prisma.milestone.findFirst({
        where: { id: body.milestoneId, projectId },
      });
      if (!ms) throw new BadRequestException('Milestone not found on this project');
    }

    const lastIssue = await this.prisma.issue.findFirst({
      where: { projectId },
      orderBy: { number: 'desc' },
    });
    const number = (lastIssue?.number ?? 0) + 1;
    const key = `${project.key}-${number}`;
    const assigneeId = await this.resolveDefaultAssigneeId(projectId);

    const issue = await this.prisma.issue.create({
      data: {
        projectId,
        number,
        key,
        title,
        description: body.description?.trim() || undefined,
        type,
        priority: priority as never,
        status: placement.status,
        metadata: metadata as never,
        reporterId,
        assigneeId: assigneeId || undefined,
        milestoneId: body.milestoneId || undefined,
      },
    });

    const clientTask = await this.prisma.clientTask.create({
      data: {
        projectId,
        title,
        description: body.description?.trim() || undefined,
        milestoneId: body.milestoneId || undefined,
        status: this.clientTaskStatusFromIssue(placement.status),
      },
    });

    await this.prisma.issue.update({
      where: { id: issue.id },
      data: {
        metadata: {
          ...this.asMeta(issue.metadata),
          portalClientTaskId: clientTask.id,
        } as never,
      },
    });

    return {
      ...issue,
      metadata: {
        ...this.asMeta(issue.metadata),
        portalClientTaskId: clientTask.id,
      },
      creatorKind: 'client' as const,
      creatorLabel: CREATOR_KIND_LABEL.client,
    };
  }

  async portalAddTaskAttachment(
    token: string,
    issueId: string,
    file: Express.Multer.File,
  ) {
    const { projectId, companyId, reporterId } = await this.resolvePortalProject(token);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Please choose a file to upload');
    }

    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, projectId },
      select: { id: true, metadata: true },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');

    const storageKey = this.storage.generateKey(
      `companies/${companyId}/issues/${issueId}`,
      file.originalname || 'upload.bin',
    );
    const { url } = await this.storage.upload(
      storageKey,
      file.buffer,
      file.mimetype || 'application/octet-stream',
    );

    const attachment = await this.prisma.attachment.create({
      data: {
        issueId,
        uploadedById: reporterId,
        name: file.originalname || 'upload.bin',
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storageKey,
        storageUrl: url,
      },
    });

    const meta = this.asMeta(issue.metadata);
    const existingIds = this.idList(meta, 'portalAttachmentIds');
    await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        metadata: {
          ...meta,
          portalAttachmentIds: [...existingIds, attachment.id],
        } as never,
      },
    });

    return { ...attachment, fromClient: true };
  }

  async portalGetTask(token: string, taskId: string) {
    const { projectId } = await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId, status: { not: 'CANCELLED' } },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        reporter: { select: { id: true, firstName: true, lastName: true } },
        milestone: { select: { id: true, name: true } },
        parent: { select: { id: true, key: true, title: true, type: true } },
        labels: { include: { label: { select: { name: true, color: true } } } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                linkedClient: { select: { id: true } },
              },
            },
          },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            storageUrl: true,
            createdAt: true,
          },
        },
      },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');

    const meta =
      issue.metadata && typeof issue.metadata === 'object'
        ? (issue.metadata as Record<string, unknown>)
        : {};
    const portalCommentIds = Array.isArray(meta.portalCommentIds)
      ? (meta.portalCommentIds as unknown[]).filter((id) => typeof id === 'string')
      : [];

    const portalAttachmentIds = this.idList(meta, 'portalAttachmentIds');
    const creatorKind = readCreatorKind(issue.metadata) || 'other';
    const canEdit = creatorKind === 'client';

    return {
      id: issue.id,
      key: issue.key,
      title: issue.title,
      description: issue.description,
      type: issue.type,
      status: issue.status,
      priority: issue.priority,
      dueDate: issue.dueDate,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      loggedHours: issue.loggedHours,
      estimatedHours: issue.estimatedHours,
      milestone: issue.milestone,
      parent: issue.parent,
      labels: issue.labels.map((l) => ({
        name: l.label.name,
        color: l.label.color,
      })),
      assignee: issue.assignee
        ? `${issue.assignee.firstName} ${issue.assignee.lastName}`.trim()
        : null,
      reporter: issue.reporter
        ? `${issue.reporter.firstName} ${issue.reporter.lastName}`.trim()
        : null,
      creatorKind,
      canEdit,
      attachments: issue.attachments.map((a) => ({
        ...a,
        fromClient: canEdit || portalAttachmentIds.includes(a.id),
      })),
      comments: issue.comments.map((c) => {
        const fromPortal = portalCommentIds.includes(c.id);
        const fromClient = Boolean(c.author?.linkedClient) || fromPortal;
        const name = `${c.author?.firstName || ''} ${c.author?.lastName || ''}`.trim();
        return {
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          authorName: fromClient ? 'Client' : name || 'Team',
          fromClient,
        };
      }),
    };
  }

  async portalAddComment(token: string, taskId: string, body: string) {
    const text = body?.trim();
    if (!text) throw new BadRequestException('Comment is required');

    const { projectId, companyId, reporterId, clientId } =
      await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId, status: { not: 'CANCELLED' } },
      select: { id: true, key: true, metadata: true },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');

    let authorId = reporterId;
    if (clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: clientId },
        select: { userId: true },
      });
      if (client?.userId) authorId = client.userId;
    }

    const comment = await this.prisma.comment.create({
      data: { issueId: taskId, authorId, body: text },
    });

    const meta =
      issue.metadata && typeof issue.metadata === 'object'
        ? { ...(issue.metadata as Record<string, unknown>) }
        : {};
    const existingIds = Array.isArray(meta.portalCommentIds)
      ? (meta.portalCommentIds as unknown[]).filter((id) => typeof id === 'string')
      : [];
    await this.prisma.issue.update({
      where: { id: taskId },
      data: {
        metadata: { ...meta, portalCommentIds: [...existingIds, comment.id] } as never,
      },
    });

    try {
      await this.prisma.activityLog.create({
        data: {
          companyId,
          userId: authorId,
          projectId,
          entityType: 'Issue',
          entityId: taskId,
          action: 'commented',
          message: `Client commented on ${issue.key}`,
          metadata: {},
        },
      });
    } catch {
      // Comment is already saved; activity is best-effort.
    }

    return {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      authorName: 'Client',
      fromClient: true,
    };
  }

  async portalUpdateTask(
    token: string,
    taskId: string,
    body: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      milestoneId?: string | null;
    },
  ) {
    const { projectId } = await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        title: true,
        description: true,
        metadata: true,
        status: true,
        milestoneId: true,
      },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');
    if (!this.isClientIssue(issue.metadata)) {
      throw new ForbiddenException('You can only edit tasks you created');
    }
    const mirroredTask = await this.findPortalClientTaskMirror(projectId, issue);

    const data: Prisma.IssueUpdateInput = {};
    if (body.title !== undefined) {
      const title = body.title.trim();
      if (!title) throw new BadRequestException('Title is required');
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = body.description.trim() || null;
    }
    if (body.priority !== undefined) {
      const allowed = new Set(['LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST', 'CRITICAL']);
      if (allowed.has(body.priority.toUpperCase())) {
        data.priority = body.priority.toUpperCase() as never;
      }
    }
    if (body.milestoneId !== undefined) {
      if (body.milestoneId) {
        const ms = await this.prisma.milestone.findFirst({
          where: { id: body.milestoneId, projectId },
        });
        if (!ms) throw new BadRequestException('Milestone not found on this project');
        data.milestone = { connect: { id: body.milestoneId } };
      } else {
        data.milestone = { disconnect: true };
      }
    }
    if (body.status !== undefined) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId },
        select: { settings: true },
      });
      const boardColumns = parseBoardColumns(project?.settings);
      const column =
        boardColumns.find((c) => c.id === body.status) ||
        boardColumns.find((c) => c.id === IssueStatus.TODO);
      if (!column) throw new BadRequestException('Unknown status');
      const placement = buildIssueUpdateForColumn(column.id, issue.metadata);
      data.status = placement.status;
      data.metadata = withCreatorKind(placement.metadata, 'client') as never;
    }

    const updated = await this.prisma.issue.update({ where: { id: taskId }, data });

    if (mirroredTask) {
      const mirrorData: Prisma.ClientTaskUpdateInput = {};
      if (body.title !== undefined) mirrorData.title = updated.title;
      if (body.description !== undefined) {
        mirrorData.description = updated.description;
      }
      if (body.milestoneId !== undefined) {
        if (body.milestoneId) {
          mirrorData.milestone = { connect: { id: body.milestoneId } };
        } else {
          mirrorData.milestone = { disconnect: true };
        }
      }
      if (body.status !== undefined) {
        mirrorData.status = this.clientTaskStatusFromIssue(updated.status);
      }
      if (Object.keys(mirrorData).length) {
        await this.prisma.clientTask.update({
          where: { id: mirroredTask.id },
          data: mirrorData,
        });
      }
    }

    return updated;
  }

  async portalDeleteTask(token: string, taskId: string) {
    const { projectId } = await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId },
      select: {
        id: true,
        title: true,
        description: true,
        metadata: true,
        attachments: { select: { storageKey: true } },
      },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');
    if (!this.isClientIssue(issue.metadata)) {
      throw new ForbiddenException('You can only delete tasks you created');
    }
    for (const file of issue.attachments) {
      await this.storage.delete(file.storageKey);
    }
    const mirroredTask = await this.findPortalClientTaskMirror(projectId, issue);
    if (mirroredTask) {
      await this.prisma.clientTask.delete({ where: { id: mirroredTask.id } });
    }
    await this.prisma.issue.delete({ where: { id: taskId } });
    return { message: 'Task deleted' };
  }

  async portalUpdateComment(token: string, taskId: string, commentId: string, body: string) {
    const text = body?.trim();
    if (!text) throw new BadRequestException('Comment is required');
    const { projectId } = await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, metadata: true },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');
    const portalCommentIds = this.idList(this.asMeta(issue.metadata), 'portalCommentIds');
    if (!portalCommentIds.includes(commentId)) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, issueId: taskId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body: text },
    });
    return {
      id: updated.id,
      body: updated.body,
      createdAt: updated.createdAt,
      authorName: 'Client',
      fromClient: true,
    };
  }

  async portalDeleteComment(token: string, taskId: string, commentId: string) {
    const { projectId } = await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, metadata: true },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');
    const meta = this.asMeta(issue.metadata);
    const portalCommentIds = this.idList(meta, 'portalCommentIds');
    if (!portalCommentIds.includes(commentId)) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, issueId: taskId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.prisma.issue.update({
      where: { id: taskId },
      data: {
        metadata: {
          ...meta,
          portalCommentIds: portalCommentIds.filter((id) => id !== commentId),
        } as never,
      },
    });
    return { message: 'Comment deleted' };
  }

  async portalUpdateAttachment(
    token: string,
    taskId: string,
    attachmentId: string,
    name: string,
  ) {
    const label = name?.trim();
    if (!label) throw new BadRequestException('Name is required');
    const { projectId } = await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, metadata: true },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');
    const canManage =
      this.isClientIssue(issue.metadata) ||
      this.idList(this.asMeta(issue.metadata), 'portalAttachmentIds').includes(attachmentId);
    if (!canManage) {
      throw new ForbiddenException('You can only rename files you uploaded');
    }
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, issueId: taskId },
    });
    if (!attachment) throw new NotFoundException('File not found');
    return this.prisma.attachment.update({
      where: { id: attachmentId },
      data: { name: label },
    });
  }

  async portalDeleteAttachment(token: string, taskId: string, attachmentId: string) {
    const { projectId } = await this.resolvePortalProject(token);
    const issue = await this.prisma.issue.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, metadata: true },
    });
    if (!issue) throw new NotFoundException('Task not found on this project');
    const meta = this.asMeta(issue.metadata);
    const portalAttachmentIds = this.idList(meta, 'portalAttachmentIds');
    const canManage =
      this.isClientIssue(issue.metadata) || portalAttachmentIds.includes(attachmentId);
    if (!canManage) {
      throw new ForbiddenException('You can only delete files you uploaded');
    }
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, issueId: taskId },
    });
    if (!attachment) throw new NotFoundException('File not found');
    await this.storage.delete(attachment.storageKey);
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    if (portalAttachmentIds.includes(attachmentId)) {
      await this.prisma.issue.update({
        where: { id: taskId },
        data: {
          metadata: {
            ...meta,
            portalAttachmentIds: portalAttachmentIds.filter((id) => id !== attachmentId),
          } as never,
        },
      });
    }
    return { message: 'File deleted' };
  }

  async portalUpdateDocument(token: string, documentId: string, name: string) {
    const label = name?.trim();
    if (!label) throw new BadRequestException('Name is required');
    const { projectId } = await this.resolvePortalProject(token);
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.isClientDocument(doc)) {
      throw new ForbiddenException('You can only rename files you uploaded');
    }
    return this.prisma.document.update({
      where: { id: documentId },
      data: { name: label, originalName: label },
    });
  }

  async portalDeleteDocument(token: string, documentId: string) {
    const { projectId } = await this.resolvePortalProject(token);
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (!this.isClientDocument(doc)) {
      throw new ForbiddenException('You can only delete files you uploaded');
    }
    await this.storage.delete(doc.storageKey);
    await this.prisma.document.delete({ where: { id: documentId } });
    return { message: 'Document deleted' };
  }

  async portalUploadDocument(token: string, file: Express.Multer.File, name?: string) {
    const { projectId, companyId, clientId, reporterId } =
      await this.resolvePortalProject(token);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Please choose a file to upload');
    }

    try {
      const key = this.storage.generateKey(
        `companies/${companyId}/projects/${projectId}/portal`,
        file.originalname || 'upload.bin',
      );
      const { url } = await this.storage.upload(
        key,
        file.buffer,
        file.mimetype || 'application/octet-stream',
      );

      return this.prisma.document.create({
        data: {
          companyId,
          projectId,
          clientId: clientId || undefined,
          uploadedById: reporterId,
          name: (name || file.originalname || 'Upload').trim(),
          originalName: file.originalname || 'upload.bin',
          type: 'CUSTOM',
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          storageKey: key,
          storageUrl: url,
          isClientVisible: true,
          metadata: { portalClient: true } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Upload failed — check storage configuration';
      throw new BadRequestException(message);
    }
  }

  /**
   * Resolve a downloadable URL or payload for a portal document (public token auth).
   */
  async portalDownloadDocument(token: string, documentId: string) {
    const project = await this.prisma.project.findFirst({
      where: { portalToken: token, portalEnabled: true },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Portal not found or disabled');

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId: project.id },
    });
    if (!doc) throw new NotFoundException('Document not found');

    if (
      doc.mimeType === 'text/uri-list' ||
      doc.storageKey.startsWith('portal-link/')
    ) {
      if (!doc.storageUrl) throw new NotFoundException('Link not available');
      return {
        kind: 'url' as const,
        url: doc.storageUrl,
        name: doc.name,
        mimeType: doc.mimeType,
      };
    }

    if (doc.storageUrl) {
      return {
        kind: 'url' as const,
        url: doc.storageUrl,
        name: doc.originalName || doc.name,
        mimeType: doc.mimeType,
      };
    }

    const signed = await this.storage.getSignedUrl(doc.storageKey);
    if (signed) {
      return {
        kind: 'url' as const,
        url: signed,
        name: doc.originalName || doc.name,
        mimeType: doc.mimeType,
      };
    }

    const buffer = await this.storage.getObjectBuffer(doc.storageKey);
    return {
      kind: 'base64' as const,
      name: doc.originalName || doc.name,
      mimeType: doc.mimeType || 'application/octet-stream',
      content: buffer.toString('base64'),
      size: buffer.length,
    };
  }

  async portalAddLink(
    token: string,
    body: { name: string; url: string },
  ) {
    const { projectId, companyId, clientId, reporterId } =
      await this.resolvePortalProject(token);
    const name = body.name?.trim();
    const url = body.url?.trim();
    if (!name) throw new BadRequestException('Link name is required');
    if (!url) throw new BadRequestException('URL is required');
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      throw new BadRequestException('Enter a valid URL (include https://)');
    }

    const storageKey = `portal-link/${projectId}/${randomBytes(8).toString('hex')}`;
    return this.prisma.document.create({
      data: {
        companyId,
        projectId,
        clientId: clientId || undefined,
        uploadedById: reporterId,
        name,
        originalName: name,
        type: 'CUSTOM',
        mimeType: 'text/uri-list',
        size: 0,
        storageKey,
        storageUrl: url,
        isClientVisible: true,
        metadata: { kind: 'external_link', portalClient: true } as Prisma.InputJsonValue,
      },
    });
  }
}
