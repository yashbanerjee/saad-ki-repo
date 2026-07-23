import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../../mail/mail.service';

export const EMAIL_QUEUE = 'email';
export const NOTIFICATION_QUEUE = 'notifications';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private mail: MailService) {
    super();
  }

  async process(job: Job<{ to: string; subject: string; html: string }>) {
    this.logger.log(`Processing email job ${job.id} to ${job.data.to}`);
    await this.mail.sendMail(job.data.to, job.data.subject, job.data.html);
  }
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  async process(job: Job<{ userId: string; title: string; body: string }>) {
    this.logger.log(`Processing notification job ${job.id} for user ${job.data.userId}`);
    // Stub: real implementation would persist + push via Socket.io
  }
}
