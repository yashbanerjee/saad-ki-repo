import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateWorkflowDto,
  CreateWorkflowStatusDto,
  CreateWorkflowTransitionDto,
} from './dto/workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.workflow.findMany({
      where: { companyId },
      include: {
        statuses: { orderBy: { order: 'asc' } },
        transitions: true,
        _count: { select: { projects: true } },
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, companyId },
      include: {
        statuses: { orderBy: { order: 'asc' } },
        transitions: { include: { fromStatus: true, toStatus: true } },
      },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(companyId: string, dto: CreateWorkflowDto) {
    if (dto.isDefault) {
      await this.prisma.workflow.updateMany({
        where: { companyId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.workflow.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async addStatus(workflowId: string, companyId: string, dto: CreateWorkflowStatusDto) {
    await this.findOne(workflowId, companyId);
    const count = await this.prisma.workflowStatus.count({ where: { workflowId } });
    return this.prisma.workflowStatus.create({
      data: {
        workflowId,
        name: dto.name,
        slug: dto.slug,
        color: dto.color,
        category: dto.category,
        order: count,
        isInitial: dto.isInitial ?? false,
        isFinal: dto.isFinal ?? false,
      },
    });
  }

  async addTransition(workflowId: string, companyId: string, dto: CreateWorkflowTransitionDto) {
    await this.findOne(workflowId, companyId);
    return this.prisma.workflowTransition.create({
      data: {
        workflowId,
        fromStatusId: dto.fromStatusId,
        toStatusId: dto.toStatusId,
        name: dto.name,
        requiresApproval: dto.requiresApproval ?? false,
      },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.workflow.delete({ where: { id } });
    return { message: 'Workflow deleted' };
  }
}
