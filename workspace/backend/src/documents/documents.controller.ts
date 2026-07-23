import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { CreateFolderDto, UploadDocumentDto } from './dto/document.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

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
  ) {
    return this.documentsService.findAll(user.companyId!, folderId, projectId);
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
  @Permissions('documents:manage')
  @UseInterceptors(FileInterceptor('file'))
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
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.upload(user.companyId!, user.id, file, dto);
  }

  @Get(':id')
  @Permissions('documents:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findOne(id, user.companyId!);
  }

  @Get(':id/download')
  @Permissions('documents:read')
  getDownloadUrl(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.getDownloadUrl(id, user.companyId!);
  }

  @Delete(':id')
  @Permissions('documents:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.remove(id, user.companyId!);
  }
}
