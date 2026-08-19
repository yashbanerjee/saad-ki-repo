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
import { DealsService } from './deals.service';
import { CreateDealDto, ListDealsQueryDto, RevertDealDto, UpdateDealDto } from './dto/deal.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('deals')
@ApiBearerAuth()
@Controller('deals')
@UseGuards(PermissionsGuard)
export class DealsController {
  constructor(private dealsService: DealsService) {}

  @Get()
  @Permissions('deals:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListDealsQueryDto) {
    return this.dealsService.findAll(user.companyId!, query);
  }

  @Get('pipeline')
  @Permissions('deals:read')
  pipeline(@CurrentUser() user: AuthenticatedUser) {
    return this.dealsService.pipelineSummary(user.companyId!);
  }

  @Get(':id')
  @Permissions('deals:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dealsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('deals:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDealDto) {
    return this.dealsService.create(user.companyId!, user.id, dto);
  }

  @Patch(':id')
  @Permissions('deals:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateDealDto,
  ) {
    return this.dealsService.update(id, user.companyId!, dto);
  }

  @Post(':id/revert')
  @Permissions('deals:manage')
  revert(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RevertDealDto,
  ) {
    return this.dealsService.revertToLead(id, user.companyId!, user.id, dto);
  }

  @Delete(':id')
  @Permissions('deals:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dealsService.remove(id, user.companyId!, user.id);
  }
}
