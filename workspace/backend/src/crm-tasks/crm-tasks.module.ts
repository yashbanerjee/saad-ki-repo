import { Module } from '@nestjs/common';
import { CrmTasksService } from './crm-tasks.service';
import { CrmTasksController } from './crm-tasks.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [CrmTasksService],
  controllers: [CrmTasksController],
  exports: [CrmTasksService],
})
export class CrmTasksModule {}
