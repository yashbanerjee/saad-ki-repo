import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(PermissionsGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('projects')
  @Permissions('reports:read')
  projectSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.projectSummary(user.companyId!);
  }

  @Get('issues')
  @Permissions('reports:read')
  issueReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
  ) {
    return this.reportsService.issueReport(user.companyId!, projectId);
  }

  @Get('velocity')
  @Permissions('reports:read')
  sprintVelocity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId', ParseCuidPipe) projectId: string,
  ) {
    return this.reportsService.sprintVelocity(user.companyId!, projectId);
  }

  @Get('user-activity')
  @Permissions('reports:read')
  userActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    return this.reportsService.userActivity(user.companyId!, days ? parseInt(days, 10) : 30);
  }
}
