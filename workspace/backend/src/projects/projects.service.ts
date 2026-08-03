import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
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

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

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

  async findAll(companyId: string, page = 1, limit = 20, status?: string) {
    const { skip, take } = paginate(page, limit);
    const where = {
      companyId,
      ...(status ? { status: status as never } : {}),
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

  async findOne(id: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
            },
          },
        },
        milestones: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        clientTasks: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { milestone: { select: { id: true, name: true } } },
        },
        _count: { select: { issues: true, sprints: true, clientTasks: true, milestones: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const progress = this.progressPayload(project.milestones, project.clientTasks);
    return { ...project, ...progress };
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
        ...(dto.startDate !== undefined
          ? { startDate: dto.startDate ? new Date(dto.startDate) : null }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
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

  async addMember(id: string, companyId: string, dto: AddProjectMemberDto) {
    await this.findOne(id, companyId);
    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: dto.userId } },
      create: { projectId: id, userId: dto.userId, role: dto.role ?? 'member' },
      update: { role: dto.role ?? 'member' },
    });
  }

  async removeMember(id: string, companyId: string, userId: string) {
    await this.findOne(id, companyId);
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
        name: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
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
        company: { select: { name: true } },
      },
    });
    if (!project) throw new NotFoundException('Portal not found or disabled');

    const progress = this.progressPayload(project.milestones, project.clientTasks);
    const now = Date.now();
    const endMs = project.endDate ? new Date(project.endDate).getTime() : null;
    const daysRemaining =
      endMs != null ? Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)) : null;

    return {
      projectName: project.name,
      description: project.description,
      status: project.status,
      companyName: project.company.name,
      clientName: project.client?.name ?? project.client?.companyName ?? null,
      startDate: project.startDate,
      endDate: project.endDate,
      daysRemaining,
      milestones: project.milestones,
      tasks: project.clientTasks,
      ...progress,
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
}
