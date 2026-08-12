import { Injectable } from '@nestjs/common';
import { IssueStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const STATUS_COLORS: Record<string, string> = {
  TODO: '#64748b',
  IN_PROGRESS: '#a1c8cf',
  TESTING: '#0f6661',
  CODE_REVIEW: '#d4a574',
  READY_FOR_QA: '#c4b5a0',
  QA_FAILED: '#ef4444',
  READY_FOR_RELEASE: '#22c55e',
  DONE: '#10b981',
  CANCELLED: '#52525b',
};

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  TESTING: 'Testing',
  CODE_REVIEW: 'Review',
  READY_FOR_QA: 'Ready for QA',
  QA_FAILED: 'QA Failed',
  READY_FOR_RELEASE: 'Ready',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const DONE_STATUS: IssueStatus = IssueStatus.DONE;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverview(companyId: string) {
    const statsPayload = await this.getStats(companyId);
    const activity = await this.getActivity(companyId, 5);
    return {
      stats: Object.fromEntries(
        (statsPayload.data as { label: string; value: string }[]).map((s) => [
          s.label,
          s.value,
        ]),
      ),
      issuesByStatus: statsPayload.distribution.map((d) => ({
        status: d.name,
        count: d.value,
      })),
      recentActivity: activity,
      ...statsPayload,
    };
  }

  async getStats(companyId: string) {
    const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
    const openStatuses = {
      notIn: [IssueStatus.DONE, IssueStatus.CANCELLED] as IssueStatus[],
    };

    const projectScope: Prisma.ProjectWhereInput = { companyId };

    const [
      activeProjects,
      openTasks,
      openBugs,
      issuesByStatus,
      completedRecently,
      projects,
      projectsByStatus,
      activeSprint,
      completedSprints,
    ] = await Promise.all([
      this.prisma.project.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.issue.count({
        where: {
          project: projectScope,
          type: { not: 'BUG' },
          status: openStatuses,
        },
      }),
      this.prisma.issue.count({
        where: {
          project: projectScope,
          type: 'BUG',
          status: openStatuses,
        },
      }),
      this.prisma.issue.groupBy({
        by: ['status'],
        where: { project: projectScope },
        _count: true,
      }),
      this.prisma.issue.findMany({
        where: {
          project: projectScope,
          status: DONE_STATUS,
          updatedAt: { gte: sixWeeksAgo },
        },
        select: { type: true, updatedAt: true },
      }),
      this.prisma.project.findMany({
        where: {
          companyId,
          status: { notIn: ['ARCHIVED', 'CANCELLED'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          name: true,
          key: true,
          status: true,
          endDate: true,
          avatar: true,
          issues: {
            where: { status: { not: IssueStatus.CANCELLED } },
            select: { status: true },
          },
        },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
      }),
      this.prisma.sprint.findFirst({
        where: {
          status: 'ACTIVE',
          project: { companyId },
        },
        orderBy: [{ startDate: 'desc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          project: { select: { id: true, name: true, key: true } },
          issues: {
            where: { status: { not: IssueStatus.CANCELLED } },
            select: { id: true, status: true, type: true, storyPoints: true },
          },
        },
      }),
      this.prisma.sprint.findMany({
        where: {
          status: 'COMPLETED',
          project: { companyId },
        },
        select: {
          id: true,
          name: true,
          issues: {
            where: { status: DONE_STATUS },
            select: { storyPoints: true, type: true },
          },
        },
      }),
    ]);

    // ── Sprint Progress (active sprint only) ──────────────
    let sprintProgress: {
      hasActiveSprint: boolean;
      sprintId: string | null;
      sprintName: string | null;
      projectName: string | null;
      totalTasks: number;
      completedTasks: number;
      progressPercent: number;
      message?: string;
    };

    if (!activeSprint) {
      sprintProgress = {
        hasActiveSprint: false,
        sprintId: null,
        sprintName: null,
        projectName: null,
        totalTasks: 0,
        completedTasks: 0,
        progressPercent: 0,
        message: 'No active sprint',
      };
    } else {
      const totalTasks = activeSprint.issues.length;
      const completedTasks = activeSprint.issues.filter(
        (i) => i.status === DONE_STATUS,
      ).length;
      sprintProgress = {
        hasActiveSprint: true,
        sprintId: activeSprint.id,
        sprintName: activeSprint.name,
        projectName: activeSprint.project?.name ?? null,
        totalTasks,
        completedTasks,
        progressPercent:
          totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        message: totalTasks === 0 ? 'No sprint tasks' : undefined,
      };
    }

    // ── Avg Velocity (completed sprints) ──────────────────
    // Prefer story points when any completed sprint has them; else completed task counts.
    const completedSprintCount = completedSprints.length;
    let usesStoryPoints = false;
    let avgVelocityValue = 0;

    if (completedSprintCount > 0) {
      const totalStoryPoints = completedSprints.reduce((sum, s) => {
        return (
          sum +
          s.issues.reduce((sp, i) => sp + (typeof i.storyPoints === 'number' ? i.storyPoints : 0), 0)
        );
      }, 0);
      usesStoryPoints = totalStoryPoints > 0;

      if (usesStoryPoints) {
        avgVelocityValue = Math.round((totalStoryPoints / completedSprintCount) * 10) / 10;
      } else {
        const totalDoneTasks = completedSprints.reduce(
          (sum, s) => sum + s.issues.length,
          0,
        );
        avgVelocityValue =
          Math.round((totalDoneTasks / completedSprintCount) * 10) / 10;
      }
    }

    const data = [
      { label: 'Active Projects', value: String(activeProjects) },
      { label: 'Open Tasks', value: String(openTasks) },
      { label: 'Open Bugs', value: String(openBugs) },
      { label: 'Avg. Velocity', value: String(avgVelocityValue) },
    ];

    // ── Tasks completed vs Bugs (last 6 weeks, DONE only) ─
    const weekBuckets = this.buildWeekBuckets(6);
    for (const issue of completedRecently) {
      const key = this.weekKey(issue.updatedAt);
      const bucket = weekBuckets.find((w) => w.key === key);
      if (!bucket) continue;
      if (issue.type === 'BUG') bucket.bugs += 1;
      else bucket.tasks += 1;
    }

    const velocity = weekBuckets.map((w) => ({
      week: w.label,
      tasks: w.tasks,
      bugs: w.bugs,
    }));

    const distribution = issuesByStatus
      .filter((g) => g._count > 0)
      .map((g) => ({
        name: STATUS_LABELS[g.status] ?? g.status,
        value: g._count,
        color: STATUS_COLORS[g.status] ?? '#64748b',
      }));

    const projectProgress = projects.map((p) => {
      const total = p.issues.length;
      const done = p.issues.filter((i) => i.status === DONE_STATUS).length;
      const inProgress = p.issues.filter((i) =>
        ['IN_PROGRESS', 'TESTING', 'CODE_REVIEW', 'READY_FOR_QA'].includes(i.status),
      ).length;
      const todo = Math.max(0, total - done - inProgress);
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        key: p.key,
        status: p.status,
        dueDate: p.endDate ? p.endDate.toISOString() : null,
        avatar: p.avatar,
        totalTasks: total,
        doneTasks: done,
        inProgressTasks: inProgress,
        todoTasks: todo,
        progress,
      };
    });

    const overallDone = projectProgress.reduce((s, p) => s + p.doneTasks, 0);
    const overallTotal = projectProgress.reduce((s, p) => s + p.totalTasks, 0);
    const overallInProgress = projectProgress.reduce(
      (s, p) => s + p.inProgressTasks,
      0,
    );
    const overallTodo = projectProgress.reduce((s, p) => s + p.todoTasks, 0);

    const PROJECT_STATUS_COLORS: Record<string, string> = {
      PLANNING: '#64748b',
      ACTIVE: '#0f6661',
      ON_HOLD: '#d4a574',
      COMPLETED: '#10b981',
      ARCHIVED: '#52525b',
      CANCELLED: '#ef4444',
    };

    const projectReport = {
      overallProgress:
        overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0,
      totalProjects: projectProgress.length,
      totalTasks: overallTotal,
      doneTasks: overallDone,
      inProgressTasks: overallInProgress,
      todoTasks: overallTodo,
      byProject: projectProgress.map((p) => ({
        name: p.name.length > 18 ? `${p.name.slice(0, 16)}…` : p.name,
        fullName: p.name,
        id: p.id,
        progress: p.progress,
        done: p.doneTasks,
        total: p.totalTasks,
      })),
      byStatus: projectsByStatus
        .filter((g) => g._count > 0)
        .map((g) => ({
          name: String(g.status).replace(/_/g, ' '),
          value: g._count,
          color: PROJECT_STATUS_COLORS[g.status] ?? '#64748b',
        })),
    };

    return {
      data,
      velocity,
      distribution,
      projectProgress,
      projectReport,
      sprintProgress,
      avgVelocity: {
        value: avgVelocityValue,
        unit: usesStoryPoints ? 'story_points' : 'tasks',
        completedSprints: completedSprintCount,
        message:
          completedSprintCount === 0 ? 'No completed sprints' : undefined,
      },
    };
  }

  async getActivity(companyId: string, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const logs = await this.prisma.activityLog.findMany({
      where: { companyId },
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (logs.length > 0) {
      return logs.map((log) => ({
        id: log.id,
        action: log.action.toLowerCase().replace(/_/g, ' '),
        target: log.message || `${log.entityType} ${log.entityId}`.trim(),
        user: log.user
          ? `${log.user.firstName} ${log.user.lastName}`.trim() || log.user.email
          : 'System',
        time: log.createdAt.toISOString(),
      }));
    }

    const audits = await this.prisma.auditLog.findMany({
      where: { companyId },
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return audits.map((log) => ({
      id: log.id,
      action: String(log.action).toLowerCase().replace(/_/g, ' '),
      target: log.entityType
        ? `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ''}`
        : 'Workspace',
      user: log.user
        ? `${log.user.firstName} ${log.user.lastName}`.trim() || log.user.email
        : 'System',
      time: log.createdAt.toISOString(),
    }));
  }

  private buildWeekBuckets(weeks: number) {
    const buckets: { key: string; label: string; tasks: number; bugs: number }[] =
      [];
    const now = new Date();
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = this.weekKey(d);
      buckets.push({
        key,
        label: `W${weeks - i}`,
        tasks: 0,
        bugs: 0,
      });
    }
    return buckets;
  }

  private weekKey(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
    return `${d.getUTCFullYear()}-W${weekNo}`;
  }
}
