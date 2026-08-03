import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PortalController } from '../portal/portal.controller';

@Module({
  providers: [ProjectsService],
  controllers: [ProjectsController, PortalController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
