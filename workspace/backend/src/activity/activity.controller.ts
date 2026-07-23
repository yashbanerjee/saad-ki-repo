import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('activity')
@ApiBearerAuth()
@Controller('activity')
@UseGuards(PermissionsGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  @Permissions('projects:read')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
    @Query('projectId') projectId?: string,
  ) {
    return this.activityService.findByCompany(user.companyId!, query.page, query.limit, projectId);
  }
}
