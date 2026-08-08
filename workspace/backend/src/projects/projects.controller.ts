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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags, ApiProperty } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { ProjectsService } from './projects.service';
import { IssuesService } from '../issues/issues.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
  ListProjectsQueryDto,
  CreateMilestoneDto,
  UpdateMilestoneDto,
  CreateClientTaskDto,
  UpdateClientTaskDto,
} from './dto/project.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { IsString, MinLength } from 'class-validator';

class UpdateBoardTaskDto {
  @ApiProperty({ description: 'Board column id (enum status or custom column id)' })
  @IsString()
  status: string;
}

class BoardColumnTitleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  title: string;
}

const logoMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
};

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(PermissionsGuard)
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private issuesService: IssuesService,
  ) {}

  @Get()
  @Permissions('projects:read')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProjectsQueryDto,
  ) {
    return this.projectsService.findAll(
      user.companyId!,
      query.page,
      query.limit,
      query.status,
      query.tag,
    );
  }

  @Get('tags')
  @Permissions('projects:read')
  listTags(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.listTags(user.companyId!);
  }

  @Get('my/client')
  @Permissions('projects:read')
  findMyClientProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findForClientUser(user.id);
  }

  @Get(':id')
  @Permissions('projects:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findOne(id, user.companyId!);
  }

  @Get(':id/board')
  @Permissions('projects:read')
  getBoard(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    // Same Kanban for admin, employees, and clients
    return this.issuesService.getBoard(id, user.companyId!);
  }

  @Post(':id/board/columns')
  @Permissions('projects:manage')
  addBoardColumn(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BoardColumnTitleDto,
  ) {
    return this.issuesService.addBoardColumn(id, user.companyId!, dto.title);
  }

  @Patch(':id/board/columns/:columnId')
  @Permissions('projects:manage')
  renameBoardColumn(
    @Param('id', ParseCuidPipe) id: string,
    @Param('columnId') columnId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BoardColumnTitleDto,
  ) {
    return this.issuesService.renameBoardColumn(
      id,
      user.companyId!,
      columnId,
      dto.title,
    );
  }

  @Delete(':id/board/columns/:columnId')
  @Permissions('projects:manage')
  deleteBoardColumn(
    @Param('id', ParseCuidPipe) id: string,
    @Param('columnId') columnId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('moveToColumnId') moveToColumnId?: string,
  ) {
    return this.issuesService.deleteBoardColumn(
      id,
      user.companyId!,
      columnId,
      moveToColumnId,
    );
  }

  @Patch(':id/tasks/:taskId')
  @Permissions('projects:read')
  updateBoardTask(
    @Param('id', ParseCuidPipe) id: string,
    @Param('taskId', ParseCuidPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBoardTaskDto,
  ) {
    return this.issuesService.updateBoardTaskStatus(
      id,
      taskId,
      user.companyId!,
      user.id,
      dto.status,
    );
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

  @Post(':id/logo')
  @Permissions('projects:create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', logoMulterOptions))
  uploadLogo(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Please choose a logo image');
    return this.projectsService.uploadLogo(id, user.companyId!, file);
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

  // Portal
  @Post(':id/portal/enable')
  @Permissions('projects:manage')
  enablePortal(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.enablePortal(id, user.companyId!);
  }

  @Post(':id/portal/rotate')
  @Permissions('projects:manage')
  rotatePortal(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.rotatePortal(id, user.companyId!);
  }

  @Post(':id/portal/disable')
  @Permissions('projects:manage')
  disablePortal(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.disablePortal(id, user.companyId!);
  }

  // Milestones
  @Get(':id/milestones')
  @Permissions('projects:read')
  listMilestones(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.listMilestones(id, user.companyId!);
  }

  @Post(':id/milestones')
  @Permissions('projects:manage')
  createMilestone(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projectsService.createMilestone(id, user.companyId!, dto);
  }

  @Patch(':id/milestones/:milestoneId')
  @Permissions('projects:manage')
  updateMilestone(
    @Param('id', ParseCuidPipe) id: string,
    @Param('milestoneId', ParseCuidPipe) milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projectsService.updateMilestone(id, milestoneId, user.companyId!, dto);
  }

  @Delete(':id/milestones/:milestoneId')
  @Permissions('projects:manage')
  deleteMilestone(
    @Param('id', ParseCuidPipe) id: string,
    @Param('milestoneId', ParseCuidPipe) milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.deleteMilestone(id, milestoneId, user.companyId!);
  }

  // Client tasks
  @Get(':id/client-tasks')
  @Permissions('projects:read')
  listClientTasks(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.listClientTasks(id, user.companyId!);
  }

  @Post(':id/client-tasks')
  @Permissions('projects:manage')
  createClientTask(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientTaskDto,
  ) {
    return this.projectsService.createClientTask(id, user.companyId!, dto);
  }

  @Patch(':id/client-tasks/:taskId')
  @Permissions('projects:manage')
  updateClientTask(
    @Param('id', ParseCuidPipe) id: string,
    @Param('taskId', ParseCuidPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientTaskDto,
  ) {
    return this.projectsService.updateClientTask(id, taskId, user.companyId!, dto);
  }

  @Delete(':id/client-tasks/:taskId')
  @Permissions('projects:manage')
  deleteClientTask(
    @Param('id', ParseCuidPipe) id: string,
    @Param('taskId', ParseCuidPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.deleteClientTask(id, taskId, user.companyId!);
  }
}
