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
import { ContactsService } from './contacts.service';
import { CreateContactDto, ListContactsQueryDto, UpdateContactDto } from './dto/contact.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
@UseGuards(PermissionsGuard)
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  @Permissions('contacts:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListContactsQueryDto) {
    return this.contactsService.findAll(user.companyId!, query);
  }

  @Get(':id')
  @Permissions('contacts:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('contacts:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.companyId!, user.id, dto);
  }

  @Patch(':id')
  @Permissions('contacts:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('contacts:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contactsService.remove(id, user.companyId!, user.id);
  }
}
