import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
}
