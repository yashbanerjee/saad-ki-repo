import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  CrmTaskStatus,
  DealStatus,
  IssueStatus,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const DONE_CRM: CrmTaskStatus[] = [CrmTaskStatus.DONE, CrmTaskStatus.CANCELLED];
const DONE_ISSUE: IssueStatus[] = [IssueStatus.DONE, IssueStatus.CANCELLED];

/** Remind this many minutes before the due time (e.g. 3:00 PM → 2:30 PM). */
const LEAD_MINUTES = 30;
const LEAD_MS = LEAD_MINUTES * 60 * 1000;
/** Look slightly past the lead window so a 5‑min cron does not miss the edge. */
const LEAD_SLACK_MS = 6 * 60 * 1000;

type ReminderPhase = 'upcoming30' | 'overdue';

function phaseForDue(due: Date, now: Date): ReminderPhase | null {
  const msUntil = due.getTime() - now.getTime();
  if (msUntil <= 0) return 'overdue';
  // Between (due - 30min) and due → remind 30 minutes earlier
  if (msUntil <= LEAD_MS + LEAD_SLACK_MS) return 'upcoming30';
  return null;
}

@Injectable()
export class DueRemindersService {
  private readonly logger = new Logger(DueRemindersService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Every 5 minutes — catch the 30‑minute-before window accurately. */
  @Cron('*/5 * * * *')
  async handleDueReminders() {
    if (this.running) return;
    this.running = true;
    try {
      await Promise.all([
        this.remindCrmTasks(),
        this.remindDeals(),
        this.remindIssues(),
      ]);
    } catch (error) {
      this.logger.error('Due reminder job failed', error);
    } finally {
      this.running = false;
    }
  }

  private async remindCrmTasks() {
    const now = new Date();
    // Fetch anything due within the next 30+slack minutes, or already overdue today
    const horizon = new Date(now.getTime() + LEAD_MS + LEAD_SLACK_MS);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.crmTask.findMany({
      where: {
        deletedAt: null,
        dueDate: { not: null, lte: horizon, gte: dayStart },
        status: { notIn: DONE_CRM },
        assignedToId: { not: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        companyId: true,
        assignedToId: true,
        leadId: true,
        dealId: true,
        lead: { select: { ownerId: true } },
        deal: { select: { ownerId: true } },
      },
      take: 500,
    });

    // Also include overdue items from earlier days (still open)
    const overdueOlder = await this.prisma.crmTask.findMany({
      where: {
        deletedAt: null,
        dueDate: { not: null, lt: dayStart },
        status: { notIn: DONE_CRM },
        assignedToId: { not: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        companyId: true,
        assignedToId: true,
        leadId: true,
        dealId: true,
        lead: { select: { ownerId: true } },
        deal: { select: { ownerId: true } },
      },
      take: 200,
    });

    for (const task of [...tasks, ...overdueOlder]) {
      if (!task.dueDate || !task.assignedToId) continue;
      const phase = phaseForDue(task.dueDate, now);
      if (!phase) continue;

      const title =
        phase === 'overdue'
          ? `Overdue CRM task: ${task.title}`
          : `Reminder: ${task.title} due in ${LEAD_MINUTES} minutes`;
      const body =
        phase === 'overdue'
          ? `This task was due ${task.dueDate.toLocaleString()}.`
          : `Due at ${task.dueDate.toLocaleString()} — you have about ${LEAD_MINUTES} minutes.`;

      const recipients = [
        task.assignedToId,
        task.lead?.ownerId,
        task.deal?.ownerId,
      ];

      for (const userId of recipients) {
        if (!userId) continue;
        const already = await this.notifications.hasDueReminderToday(
          userId,
          'crmTaskId',
          task.id,
          phase,
        );
        if (already) continue;
        await this.notifications.create(
          task.companyId,
          userId,
          NotificationType.DUE_REMINDER,
          title,
          body,
          {
            crmTaskId: task.id,
            leadId: task.leadId,
            dealId: task.dealId,
            href: '/crm/tasks',
            reminderKind: phase,
          },
        );
      }
    }
  }

  private async remindDeals() {
    const now = new Date();
    const horizon = new Date(now.getTime() + LEAD_MS + LEAD_SLACK_MS);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const openStatuses = [
      DealStatus.OPEN,
      DealStatus.QUALIFICATION,
      DealStatus.PROPOSAL,
      DealStatus.NEGOTIATION,
    ];

    const deals = await this.prisma.deal.findMany({
      where: {
        deletedAt: null,
        expectedCloseDate: { not: null, lte: horizon },
        status: { in: openStatuses },
        ownerId: { not: null },
      },
      select: {
        id: true,
        title: true,
        expectedCloseDate: true,
        companyId: true,
        ownerId: true,
        lead: { select: { ownerId: true } },
      },
      take: 500,
    });

    for (const deal of deals) {
      if (!deal.expectedCloseDate || !deal.ownerId) continue;
      const phase = phaseForDue(deal.expectedCloseDate, now);
      if (!phase) continue;

      const title =
        phase === 'overdue'
          ? `Overdue deal close: ${deal.title}`
          : `Reminder: ${deal.title} closes in ${LEAD_MINUTES} minutes`;
      const body =
        phase === 'overdue'
          ? `Expected close was ${deal.expectedCloseDate.toLocaleString()}.`
          : `Expected close ${deal.expectedCloseDate.toLocaleString()}.`;

      for (const userId of [deal.ownerId, deal.lead?.ownerId]) {
        if (!userId) continue;
        const already = await this.notifications.hasDueReminderToday(
          userId,
          'dealId',
          deal.id,
          phase,
        );
        if (already) continue;
        await this.notifications.create(
          deal.companyId,
          userId,
          NotificationType.DUE_REMINDER,
          title,
          body,
          {
            dealId: deal.id,
            href: `/deals/${deal.id}`,
            reminderKind: phase,
          },
        );
      }
    }
  }

  private async remindIssues() {
    const now = new Date();
    const horizon = new Date(now.getTime() + LEAD_MS + LEAD_SLACK_MS);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const issues = await this.prisma.issue.findMany({
      where: {
        deletedAt: null,
        dueDate: { not: null, lte: horizon, gte: dayStart },
        status: { notIn: DONE_ISSUE },
      },
      select: {
        id: true,
        key: true,
        title: true,
        dueDate: true,
        projectId: true,
        assigneeId: true,
        reporterId: true,
        project: { select: { companyId: true } },
      },
      take: 500,
    });

    const overdueOlder = await this.prisma.issue.findMany({
      where: {
        deletedAt: null,
        dueDate: { not: null, lt: dayStart },
        status: { notIn: DONE_ISSUE },
      },
      select: {
        id: true,
        key: true,
        title: true,
        dueDate: true,
        projectId: true,
        assigneeId: true,
        reporterId: true,
        project: { select: { companyId: true } },
      },
      take: 200,
    });

    for (const issue of [...issues, ...overdueOlder]) {
      if (!issue.dueDate) continue;
      const phase = phaseForDue(issue.dueDate, now);
      if (!phase) continue;

      const title =
        phase === 'overdue'
          ? `Overdue: ${issue.key}`
          : `Reminder: ${issue.key} due in ${LEAD_MINUTES} minutes`;
      const body =
        phase === 'overdue'
          ? `${issue.title} was due ${issue.dueDate.toLocaleString()}.`
          : `${issue.title} is due at ${issue.dueDate.toLocaleString()}.`;

      const recipients = [issue.assigneeId, issue.reporterId];
      for (const userId of recipients) {
        if (!userId) continue;
        const already = await this.notifications.hasDueReminderToday(
          userId,
          'issueId',
          issue.id,
          phase,
        );
        if (already) continue;
        await this.notifications.create(
          issue.project.companyId,
          userId,
          NotificationType.DUE_REMINDER,
          title,
          body,
          {
            issueId: issue.id,
            projectId: issue.projectId,
            href: `/issues/${issue.id}`,
            reminderKind: phase,
          },
        );
      }
    }
  }
}
