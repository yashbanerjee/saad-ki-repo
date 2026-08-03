import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectsService } from '../projects/projects.service';
import { Public } from '../common/decorators';

@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(private projectsService: ProjectsService) {}

  @Public()
  @Get(':token')
  getPortal(@Param('token') token: string) {
    return this.projectsService.getPublicPortal(token);
  }
}
