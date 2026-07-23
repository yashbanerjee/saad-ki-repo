import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { EmailProcessor, NotificationProcessor, EMAIL_QUEUE, NOTIFICATION_QUEUE } from './processors/queue.processors';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL', 'redis://localhost:6379') },
      }),
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }, { name: NOTIFICATION_QUEUE }),
  ],
  providers: [EmailProcessor, NotificationProcessor, QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
