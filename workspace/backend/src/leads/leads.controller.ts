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
import { LeadsService } from './leads.service';
import {
  ConvertLeadDto,
  ConvertLeadToDealDto,
  CreateLeadActivityDto,
  CreateLeadDto,
  ListLeadsQueryDto,
  UpdateLeadDto,
} from './dto/lead.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
@UseGuards(PermissionsGuard)
export class LeadsController {
  constructor(private leadsService: LeadsService) {}

  @Get()
  @Permissions('leads:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListLeadsQueryDto) {
    return this.leadsService.findAll(user.companyId!, query);
  }

  @Get('stats')
  @Permissions('leads:read')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.statusCounts(user.companyId!);
  }

  @Get(':id')
  @Permissions('leads:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('leads:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLeadDto) {
    return this.leadsService.create(user.companyId!, user.id, dto);
  }

  @Patch(':id')
  @Permissions('leads:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(id, user.companyId!, user.id, dto);
  }

  @Delete(':id')
  @Permissions('leads:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.remove(id, user.companyId!);
  }

  @Post(':id/activities')
  @Permissions('leads:manage')
  addActivity(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLeadActivityDto,
  ) {
    return this.leadsService.addActivity(id, user.companyId!, user.id, dto);
  }

  @Post(':id/convert')
  @Permissions('leads:manage')
  convert(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leadsService.convert(id, user.companyId!, user.id, dto);
  }

  @Post(':id/convert-to-deal')
  @Permissions('leads:manage')
  convertToDeal(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConvertLeadToDealDto,
  ) {
    return this.leadsService.convertToDeal(id, user.companyId!, user.id, dto);
  }
}
