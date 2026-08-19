import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CrmNotesService } from './crm-notes.service';
import { CreateCrmNoteDto, ListCrmNotesQueryDto, UpdateCrmNoteDto } from './dto/crm-note.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('crm-notes')
@ApiBearerAuth()
@Controller('crm/notes')
@UseGuards(PermissionsGuard)
export class CrmNotesController {
  constructor(private crmNotesService: CrmNotesService) {}

  @Get()
  @Permissions('leads:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCrmNotesQueryDto) {
    return this.crmNotesService.findAll(user.companyId!, query);
  }

  @Post()
  @Permissions('leads:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCrmNoteDto) {
    return this.crmNotesService.create(user.companyId!, user.id, dto);
  }

  @Patch(':id')
  @Permissions('leads:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCrmNoteDto,
  ) {
    return this.crmNotesService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('leads:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crmNotesService.remove(id, user.companyId!, user.id);
  }
}
