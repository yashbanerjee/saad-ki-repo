import { Body, Controller, Get, Post, Query, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CrmCommsService } from './crm-comms.service';
import {
  CreateCrmAttachmentDto,
  CreateCrmCallLogDto,
  CreateCrmEmailDto,
  CreateCrmWhatsAppDto,
  ListCommsQueryDto,
} from './dto/crm-comms.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';

const crmUploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
};

@ApiTags('crm-comms')
@ApiBearerAuth()
@Controller('crm')
@UseGuards(PermissionsGuard)
export class CrmCommsController {
  constructor(private crmCommsService: CrmCommsService) {}

  @Get('emails')
  @Permissions('leads:read')
  listEmails(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCommsQueryDto) {
    return this.crmCommsService.listEmails(user.companyId!, query);
  }

  @Post('emails')
  @Permissions('leads:manage')
  createEmail(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCrmEmailDto) {
    return this.crmCommsService.createEmail(user.companyId!, user.id, dto);
  }

  @Get('calls')
  @Permissions('leads:read')
  listCalls(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCommsQueryDto) {
    return this.crmCommsService.listCalls(user.companyId!, query);
  }

  @Post('calls')
  @Permissions('leads:manage')
  createCall(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCrmCallLogDto) {
    return this.crmCommsService.createCall(user.companyId!, user.id, dto);
  }

  @Get('whatsapp')
  @Permissions('leads:read')
  listWhatsApp(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCommsQueryDto) {
    return this.crmCommsService.listWhatsApp(user.companyId!, query);
  }

  @Post('whatsapp')
  @Permissions('leads:manage')
  createWhatsApp(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCrmWhatsAppDto) {
    return this.crmCommsService.createWhatsApp(user.companyId!, user.id, dto);
  }

  @Get('attachments')
  @Permissions('leads:read')
  listAttachments(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCommsQueryDto) {
    return this.crmCommsService.listAttachments(user.companyId!, query);
  }

  @Post('attachments')
  @Permissions('leads:manage')
  createAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCrmAttachmentDto,
  ) {
    return this.crmCommsService.createAttachment(user.companyId!, user.id, dto);
  }

  @Post('attachments/upload')
  @Permissions('leads:manage')
  @UseInterceptors(FileInterceptor('file', crmUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        fileName: { type: 'string' },
        leadId: { type: 'string' },
        dealId: { type: 'string' },
        contactId: { type: 'string' },
      },
    },
  })
  uploadAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('leadId') leadId?: string,
    @Body('dealId') dealId?: string,
    @Body('contactId') contactId?: string,
    @Body('fileName') fileName?: string,
  ) {
    if (!file) throw new BadRequestException('Please choose a file to upload');
    return this.crmCommsService.uploadAttachment(user.companyId!, user.id, file, {
      leadId,
      dealId,
      contactId,
      fileName,
    });
  }
}
