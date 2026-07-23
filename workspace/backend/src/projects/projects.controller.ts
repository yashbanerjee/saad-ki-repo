import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, AddProjectMemberDto } from './dto/project.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(PermissionsGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  @Permissions('projects:read')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
    @Query('status') status?: string,
  ) {
    return this.projectsService.findAll(user.companyId!, query.page, query.limit, status);
  }

  @Get(':id')
  @Permissions('projects:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('projects:create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.companyId!, user.id, dto);
  }

  @Patch(':id')
  @Permissions('projects:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.companyId!, dto);
  }

  @Post(':id/archive')
  @Permissions('projects:manage')
  archive(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.archive(id, user.companyId!);
  }

  @Post(':id/members')
  @Permissions('projects:manage')
  addMember(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(id, user.companyId!, dto);
  }

  @Delete(':id/members/:userId')
  @Permissions('projects:manage')
  removeMember(
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.removeMember(id, user.companyId!, userId);
  }
}
