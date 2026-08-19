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
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentsService, uploadMulterOptions } from './documents.service';
import {
  CreateFolderDto,
  UploadDocumentDto,
  UpdateDocumentDto,
} from './dto/document.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('documents')
@ApiBearerAuth()
@Controller('documents')
@UseGuards(PermissionsGuard)
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get()
  @Permissions('documents:read')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('folderId') folderId?: string,
    @Query('projectId') projectId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.documentsService.findAll(user, folderId, projectId, clientId);
  }

  @Get('folders')
  @Permissions('documents:read')
  findFolders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('parentId') parentId?: string,
  ) {
    return this.documentsService.findFolders(user.companyId!, parentId);
  }

  @Post('folders')
  @Permissions('documents:manage')
  createFolder(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFolderDto) {
    return this.documentsService.createFolder(user.companyId!, dto);
  }

  @Post('upload')
  @Permissions('documents:read')
  @UseInterceptors(FileInterceptor('file', uploadMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        type: { type: 'string' },
        clientId: { type: 'string' },
        projectId: { type: 'string' },
        folderId: { type: 'string' },
      },
    },
  })
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    if (user.roles?.includes('client') && user.companyId) {
      await this.documentsService.ensureClientUploadPermission(user.companyId);
    }
    if (!file) {
      throw new BadRequestException('Please choose a file to upload');
    }
    return this.documentsService.upload(user, file, {
      name: dto.name || file.originalname,
      type: dto.type,
      clientId: dto.clientId,
      projectId: dto.projectId,
      folderId: dto.folderId,
      isClientVisible: dto.isClientVisible,
    });
  }

  @Patch(':id')
  @Permissions('documents:read')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.updateDocument(id, user, dto);
  }

  @Get(':id')
  @Permissions('documents:read')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findOne(id, user);
  }

  @Get(':id/download')
  @Permissions('documents:read')
  getDownloadUrl(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.getDownloadUrl(id, user);
  }

  @Delete(':id')
  @Permissions('documents:read')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.remove(id, user);
  }
}
