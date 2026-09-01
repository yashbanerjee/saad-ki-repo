import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { DueRemindersService } from './due-reminders.service';

@Module({
  imports: [JwtModule.register({}), ScheduleModule.forRoot()],
  providers: [NotificationsService, NotificationsGateway, DueRemindersService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
