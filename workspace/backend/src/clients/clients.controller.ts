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
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(PermissionsGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @Permissions('clients:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.clientsService.findAll(user.companyId!, query.page, query.limit);
  }

  @Get(':id')
  @Permissions('clients:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('clients:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('clients:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('clients:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.remove(id, user.companyId!);
  }
}
