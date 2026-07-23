import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async projectSummary(companyId: string) {
    const projects = await this.prisma.project.findMany({
      where: { companyId },
      select: {
        id: true,
        key: true,
        name: true,
        status: true,
        _count: { select: { issues: true, members: true, sprints: true } },
      },
    });

    return projects.map((p) => ({
      ...p,
      issueCount: p._count.issues,
      memberCount: p._count.members,
      sprintCount: p._count.sprints,
    }));
  }

  async issueReport(companyId: string, projectId?: string) {
    const where = {
      project: { companyId, ...(projectId ? { id: projectId } : {}) },
    };

    const [byType, byPriority, byAssignee, overdue] = await Promise.all([
      this.prisma.issue.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.issue.groupBy({ by: ['priority'], where, _count: true }),
      this.prisma.issue.groupBy({ by: ['assigneeId'], where, _count: true }),
      this.prisma.issue.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
    ]);

    return { byType, byPriority, byAssignee, overdueCount: overdue };
  }

  async sprintVelocity(companyId: string, projectId: string) {
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId, project: { companyId } },
      include: {
        issues: {
          select: { storyPoints: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return sprints.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      totalPoints: s.issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
      completedPoints: s.issues
        .filter((i) => i.status === 'DONE')
        .reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
      issueCount: s.issues.length,
    }));
  }

  async userActivity(companyId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.activityLog.groupBy({
      by: ['userId'],
      where: { companyId, createdAt: { gte: since }, userId: { not: null } },
      _count: true,
      orderBy: { _count: { userId: 'desc' } },
      take: 20,
    });
  }
}
