import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import {
  parseCompanySettings,
  parseUserPreferences,
  type NotificationPrefs,
} from '../common/workspace-settings';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
    private mail: MailService,
    private push: PushService,
    private config: ConfigService,
  ) {}

  async findAll(
    userId: string,
    unreadOnly = false,
    page = 1,
    limit = 20,
    options?: { recentDays?: number },
  ) {
    const skip = (page - 1) * limit;
    const since =
      options?.recentDays && options.recentDays > 0
        ? new Date(Date.now() - options.recentDays * 24 * 60 * 60 * 1000)
        : undefined;
    const where = {
      userId,
      ...(unreadOnly ? { read: false } : {}),
      ...(since ? { createdAt: { gte: since } } : {}),
    };
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { data, total, page, limit, unreadCount };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  }

  async create(
    companyId: string,
    userId: string,
    type: NotificationType,
    title: string,
    body?: string,
    data?: Record<string, unknown>,
  ) {
    const [user, company] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, preferences: true },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { settings: true },
      }),
    ]);

    const prefs = parseUserPreferences(user?.preferences);
    const workspace = parseCompanySettings(company?.settings).workspace;
    const category = categoryPref(type);
    const categoryEnabled =
      category === 'always' ? true : prefs.notifications[category];

    if (!categoryEnabled) {
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        companyId,
        userId,
        type,
        title,
        body,
        data: (data ?? {}) as object,
      },
    });

    this.gateway.sendToUser(userId, notification);

    if (prefs.notifications.push) {
      void this.push
        .sendToUser(companyId, userId, title, body, {
          type,
          ...(data ?? {}),
        })
        .catch((error) => this.logger.error('Push delivery failed', error));
    }

    if (
      workspace.sendNotificationEmails &&
      prefs.notifications.emailReceive &&
      user?.email
    ) {
      const origin = (this.config.get<string>('CORS_ORIGIN') || '').split(',')[0];
      const html = `<p>${escapeHtml(body || title)}</p>${
        origin ? `<p><a href="${origin}">Open TaskFlow</a></p>` : ''
      }`;
      void this.mail
        .sendMail(user.email, title, html, companyId)
        .catch((error) => this.logger.error('Notification email failed', error));
    }

    return notification;
  }

  async notifyStakeholders(opts: {
    companyId: string;
    actorId?: string | null;
    projectId?: string | null;
    extraUserIds?: Array<string | null | undefined>;
    type: NotificationType;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
  }) {
    const ids = new Set<string>();
    for (const id of opts.extraUserIds ?? []) {
      if (id) ids.add(id);
    }

    if (opts.projectId) {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId: opts.projectId },
        select: { userId: true },
      });
      for (const member of members) ids.add(member.userId);
    }

    const admins = await this.prisma.user.findMany({
      where: {
        companyId: opts.companyId,
        roles: {
          some: {
            role: {
              slug: { in: ['company_admin', 'super_admin', 'project_manager'] },
            },
          },
        },
      },
      select: { id: true },
    });
    for (const admin of admins) ids.add(admin.id);

    if (opts.actorId) ids.delete(opts.actorId);

    await Promise.all(
      [...ids].map((userId) =>
        this.create(
          opts.companyId,
          userId,
          opts.type,
          opts.title,
          opts.body,
          opts.data,
        ),
      ),
    );
  }
}

function categoryPref(
  type: NotificationType,
): keyof NotificationPrefs | 'always' {
  switch (type) {
    case NotificationType.ASSIGNMENT:
    case NotificationType.ISSUE:
    case NotificationType.DUE_REMINDER:
      return 'assignments';
    case NotificationType.COMMENT:
    case NotificationType.MENTION:
      return 'comments';
    case NotificationType.PROJECT:
    case NotificationType.STATUS_CHANGE:
      return 'projects';
    case NotificationType.ONBOARDING:
    case NotificationType.NDA:
      return 'clientActivity';
    default:
      return 'always';
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
