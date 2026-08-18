import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { ProjectsService } from '../projects/projects.service';
import { CreateMilestoneDto } from '../projects/dto/project.dto';
import { Public } from '../common/decorators';

class PortalCreateTaskDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  milestoneId?: string;
}

class PortalAddLinkDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(3)
  url: string;
}

class PortalAddCommentDto {
  @IsString()
  @MinLength(1)
  body: string;
}

class PortalUpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  milestoneId?: string;
}

class PortalRenameDto {
  @IsString()
  @MinLength(1)
  name: string;
}

const uploadMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
};

@ApiTags('portal')
@Controller('portal')
export class PortalController {
  constructor(private projectsService: ProjectsService) {}

  /** Register nested route before bare :token so Nest matches download first */
  @Public()
  @Get(':token/documents/:documentId/download')
  downloadDocument(
    @Param('token') token: string,
    @Param('documentId') documentId: string,
  ) {
    return this.projectsService.portalDownloadDocument(token, documentId);
  }

  @Public()
  @Get(':token/tasks/:taskId')
  getTask(@Param('token') token: string, @Param('taskId') taskId: string) {
    return this.projectsService.portalGetTask(token, taskId);
  }

  @Public()
  @Get(':token')
  getPortal(@Param('token') token: string) {
    return this.projectsService.getPublicPortal(token);
  }

  @Public()
  @Post(':token/milestones')
  createMilestone(
    @Param('token') token: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projectsService.portalCreateMilestone(token, dto);
  }

  @Public()
  @Post(':token/tasks')
  createTask(
    @Param('token') token: string,
    @Body() dto: PortalCreateTaskDto,
  ) {
    return this.projectsService.portalCreateTask(token, dto);
  }

  @Public()
  @Patch(':token/tasks/:taskId')
  updateTask(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Body() dto: PortalUpdateTaskDto,
  ) {
    return this.projectsService.portalUpdateTask(token, taskId, dto);
  }

  @Public()
  @Delete(':token/tasks/:taskId')
  deleteTask(@Param('token') token: string, @Param('taskId') taskId: string) {
    return this.projectsService.portalDeleteTask(token, taskId);
  }

  @Public()
  @Post(':token/tasks/:taskId/comments')
  addComment(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Body() dto: PortalAddCommentDto,
  ) {
    return this.projectsService.portalAddComment(token, taskId, dto.body);
  }

  @Public()
  @Patch(':token/tasks/:taskId/comments/:commentId')
  updateComment(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: PortalAddCommentDto,
  ) {
    return this.projectsService.portalUpdateComment(token, taskId, commentId, dto.body);
  }

  @Public()
  @Delete(':token/tasks/:taskId/comments/:commentId')
  deleteComment(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.projectsService.portalDeleteComment(token, taskId, commentId);
  }

  @Public()
  @Post(':token/tasks/:taskId/attachments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadMulterOptions))
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  addTaskAttachment(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Please choose a file to upload');
    return this.projectsService.portalAddTaskAttachment(token, taskId, file);
  }

  @Public()
  @Patch(':token/tasks/:taskId/attachments/:attachmentId')
  renameAttachment(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @Body() dto: PortalRenameDto,
  ) {
    return this.projectsService.portalUpdateAttachment(
      token,
      taskId,
      attachmentId,
      dto.name,
    );
  }

  @Public()
  @Delete(':token/tasks/:taskId/attachments/:attachmentId')
  deleteAttachment(
    @Param('token') token: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.projectsService.portalDeleteAttachment(token, taskId, attachmentId);
  }

  @Public()
  @Post(':token/links')
  addLink(@Param('token') token: string, @Body() dto: PortalAddLinkDto) {
    return this.projectsService.portalAddLink(token, dto);
  }

  @Public()
  @Post(':token/documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', uploadMulterOptions))
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
      },
      required: ['file'],
    },
  })
  uploadDocument(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string },
  ) {
    if (!file) throw new BadRequestException('Please choose a file to upload');
    return this.projectsService.portalUploadDocument(token, file, body?.name);
  }

  @Public()
  @Patch(':token/documents/:documentId')
  renameDocument(
    @Param('token') token: string,
    @Param('documentId') documentId: string,
    @Body() dto: PortalRenameDto,
  ) {
    return this.projectsService.portalUpdateDocument(token, documentId, dto.name);
  }

  @Public()
  @Delete(':token/documents/:documentId')
  deleteDocument(
    @Param('token') token: string,
    @Param('documentId') documentId: string,
  ) {
    return this.projectsService.portalDeleteDocument(token, documentId);
  }
}
