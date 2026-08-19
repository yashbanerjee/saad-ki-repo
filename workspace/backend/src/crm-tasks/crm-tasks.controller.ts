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
import { CrmTasksService } from './crm-tasks.service';
import { CreateCrmTaskDto, ListCrmTasksQueryDto, UpdateCrmTaskDto } from './dto/crm-task.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('crm-tasks')
@ApiBearerAuth()
@Controller('crm/tasks')
@UseGuards(PermissionsGuard)
export class CrmTasksController {
  constructor(private crmTasksService: CrmTasksService) {}

  @Get()
  @Permissions('crm_tasks:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListCrmTasksQueryDto) {
    return this.crmTasksService.findAll(user.companyId!, query);
  }

  @Get(':id')
  @Permissions('crm_tasks:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crmTasksService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('crm_tasks:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCrmTaskDto) {
    return this.crmTasksService.create(user.companyId!, user.id, dto);
  }

  @Patch(':id')
  @Permissions('crm_tasks:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCrmTaskDto,
  ) {
    return this.crmTasksService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('crm_tasks:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.crmTasksService.remove(id, user.companyId!, user.id);
  }
}
