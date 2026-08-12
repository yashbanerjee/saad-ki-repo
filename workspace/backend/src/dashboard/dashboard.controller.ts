import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(PermissionsGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('overview')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Full dashboard overview (stats + activity)' })
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getOverview(user.companyId!);
  }

  @Get('stats')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Dashboard KPI cards, velocity, and status distribution' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getStats(user.companyId!);
  }

  @Get('activity')
  @Permissions('dashboard:read')
  @ApiOperation({ summary: 'Recent workspace activity feed' })
  getActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number(limit) : 5;
    return this.dashboardService.getActivity(
      user.companyId!,
      Number.isFinite(take) ? take : 5,
    );
  }
}
