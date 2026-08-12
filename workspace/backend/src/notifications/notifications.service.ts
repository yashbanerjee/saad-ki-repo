import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
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
    return notification;
  }
}
