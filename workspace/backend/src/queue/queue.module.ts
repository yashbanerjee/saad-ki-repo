import { DynamicModule, Injectable, Logger, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import {
  EmailProcessor,
  NotificationProcessor,
  EMAIL_QUEUE,
  NOTIFICATION_QUEUE,
} from './processors/queue.processors';
import { QueueService } from './queue.service';

/** Used when REDIS_URL is missing so the API can still boot on Railway. */
@Injectable()
export class NoopQueueService {
  private readonly log = new Logger('NoopQueueService');

  async enqueueEmail(to: string, subject: string, html: string, _companyId?: string) {
    this.log.warn(`Queue disabled — skipped email to ${to}: ${subject}`);
    return null;
  }

  async enqueueNotification(userId: string, title: string, body: string) {
    this.log.warn(`Queue disabled — skipped notification for ${userId}: ${title}`);
    return null;
  }
}

@Module({})
export class QueueModule {
  static register(): DynamicModule {
    const redisUrl = process.env.REDIS_URL?.trim();
    const enabled = Boolean(redisUrl) && process.env.DISABLE_QUEUES !== 'true';

    if (!enabled) {
      return {
        module: QueueModule,
        providers: [{ provide: QueueService, useClass: NoopQueueService }],
        exports: [QueueService],
      };
    }

    return {
      module: QueueModule,
      imports: [
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              url: config.get<string>('REDIS_URL'),
              maxRetriesPerRequest: null,
            },
          }),
        }),
        BullModule.registerQueue({ name: EMAIL_QUEUE }, { name: NOTIFICATION_QUEUE }),
      ],
      providers: [EmailProcessor, NotificationProcessor, QueueService],
      exports: [QueueService, BullModule],
    };
  }
}
