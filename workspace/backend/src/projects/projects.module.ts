import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PortalController } from '../portal/portal.controller';
import { IssuesModule } from '../issues/issues.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [IssuesModule, NotificationsModule],
  providers: [ProjectsService],
  controllers: [ProjectsController, PortalController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
