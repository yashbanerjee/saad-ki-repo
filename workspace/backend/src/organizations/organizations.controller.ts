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
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  ListOrganizationsQueryDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(PermissionsGuard)
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Get()
  @Permissions('organizations:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListOrganizationsQueryDto) {
    return this.organizationsService.findAll(user.companyId!, query);
  }

  @Get(':id')
  @Permissions('organizations:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('organizations:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('organizations:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('organizations:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.remove(id, user.companyId!, user.id);
  }
}
