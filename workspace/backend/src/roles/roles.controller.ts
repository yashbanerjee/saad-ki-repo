import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @Permissions('roles:read')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.findAll(user.companyId!);
  }

  @Get('permissions')
  @Permissions('roles:read')
  findPermissions() {
    return this.rolesService.findPermissions();
  }

  @Get(':id')
  @Permissions('roles:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('roles:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('roles:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('roles:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rolesService.remove(id, user.companyId!);
  }
}
