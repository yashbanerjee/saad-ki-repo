import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto/project.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

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
        include: { client: true, _count: { select: { members: true, issues: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        members: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
        _count: { select: { issues: true, sprints: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async create(companyId: string, userId: string, dto: CreateProjectDto) {
    const key = dto.key.toUpperCase();
    const existing = await this.prisma.project.findFirst({
      where: { companyId, key },
    });
    if (existing) throw new ConflictException('Project key already exists');

    return this.prisma.project.create({
      data: {
        companyId,
        key,
        name: dto.name,
        description: dto.description,
        clientId: dto.clientId,
        members: { create: { userId, role: 'owner' } },
      },
      include: { members: true },
    });
  }

  async update(id: string, companyId: string, dto: UpdateProjectDto) {
    await this.findOne(id, companyId);
    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        clientId: dto.clientId,
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
}
