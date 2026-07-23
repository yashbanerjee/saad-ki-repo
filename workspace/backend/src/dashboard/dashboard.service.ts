import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(companyId: string) {
    const [
      totalProjects,
      activeProjects,
      totalIssues,
      openIssues,
      totalUsers,
      totalClients,
      recentActivity,
      issuesByStatus,
    ] = await Promise.all([
      this.prisma.project.count({ where: { companyId } }),
      this.prisma.project.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.issue.count({ where: { project: { companyId } } }),
      this.prisma.issue.count({
        where: { project: { companyId }, status: { notIn: ['DONE', 'CANCELLED'] } },
      }),
      this.prisma.user.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.client.count({ where: { companyId, status: 'active' } }),
      this.prisma.activityLog.findMany({
        where: { companyId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.issue.groupBy({
        by: ['status'],
        where: { project: { companyId } },
        _count: true,
      }),
    ]);

    return {
      stats: {
        totalProjects,
        activeProjects,
        totalIssues,
        openIssues,
        totalUsers,
        totalClients,
      },
      issuesByStatus: issuesByStatus.map((g) => ({
        status: g.status,
        count: g._count,
      })),
      recentActivity,
    };
  }
}
