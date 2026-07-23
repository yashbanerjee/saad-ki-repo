import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateDepartmentDto, CreateTeamDto, AddTeamMemberDto } from './dto/team.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('teams')
@ApiBearerAuth()
@Controller('teams')
@UseGuards(PermissionsGuard)
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Get('departments')
  @Permissions('teams:read')
  findDepartments(@CurrentUser() user: AuthenticatedUser) {
    return this.teamsService.findDepartments(user.companyId!);
  }

  @Post('departments')
  @Permissions('teams:manage')
  createDepartment(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDepartmentDto) {
    return this.teamsService.createDepartment(user.companyId!, dto);
  }

  @Get()
  @Permissions('teams:read')
  findTeams(
    @CurrentUser() user: AuthenticatedUser,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.teamsService.findTeams(user.companyId!, departmentId);
  }

  @Post()
  @Permissions('teams:manage')
  createTeam(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(user.companyId!, dto);
  }

  @Post(':id/members')
  @Permissions('teams:manage')
  addMember(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(id, user.companyId!, dto);
  }

  @Delete(':id/members/:userId')
  @Permissions('teams:manage')
  removeMember(
    @Param('id', ParseCuidPipe) id: string,
    @Param('userId', ParseCuidPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teamsService.removeMember(id, user.companyId!, userId);
  }
}
