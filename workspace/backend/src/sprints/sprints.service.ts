import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';

@Injectable()
export class SprintsService {
  constructor(private prisma: PrismaService) {}

  async findByProject(projectId: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.sprint.findMany({
      where: { projectId },
      include: { _count: { select: { issues: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id, project: { companyId } },
      include: {
        issues: {
          include: {
            assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
    });
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  async create(companyId: string, dto: CreateSprintDto) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, companyId },
    });
    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.sprint.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        goal: dto.goal,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async update(id: string, companyId: string, dto: UpdateSprintDto) {
    await this.findOne(id, companyId);
    return this.prisma.sprint.update({
      where: { id },
      data: {
        name: dto.name,
        goal: dto.goal,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async start(id: string, companyId: string) {
    const sprint = await this.findOne(id, companyId);
    if (sprint.status !== 'PLANNED') {
      throw new BadRequestException('Only planned sprints can be started');
    }
    return this.prisma.sprint.update({
      where: { id },
      data: { status: 'ACTIVE', startDate: sprint.startDate ?? new Date() },
    });
  }

  async complete(id: string, companyId: string) {
    const sprint = await this.findOne(id, companyId);
    if (sprint.status !== 'ACTIVE') {
      throw new BadRequestException('Only active sprints can be completed');
    }
    return this.prisma.sprint.update({
      where: { id },
      data: { status: 'COMPLETED', endDate: sprint.endDate ?? new Date() },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.sprint.delete({ where: { id } });
    return { message: 'Sprint deleted' };
  }
}
