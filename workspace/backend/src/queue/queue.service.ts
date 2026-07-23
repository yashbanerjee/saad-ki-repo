import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE, NOTIFICATION_QUEUE } from './processors/queue.processors';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private emailQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private notificationQueue: Queue,
  ) {}

  async enqueueEmail(to: string, subject: string, html: string) {
    return this.emailQueue.add('send', { to, subject, html });
  }

  async enqueueNotification(userId: string, title: string, body: string) {
    return this.notificationQueue.add('notify', { userId, title, body });
  }
}
