import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ActivityLogInput {
  companyId: string;
  userId?: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  action: string;
  message: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async log(input: ActivityLogInput) {
    return this.prisma.activityLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        message: input.message,
        metadata: (input.metadata ?? {}) as object,
      },
    });
  }

  async findByCompany(companyId: string, page = 1, limit = 20, projectId?: string) {
    const skip = (page - 1) * limit;
    const where = { companyId, ...(projectId ? { projectId } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
