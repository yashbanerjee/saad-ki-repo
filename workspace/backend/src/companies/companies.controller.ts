import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/company.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('companies')
@ApiBearerAuth()
@Controller('companies')
@UseGuards(PermissionsGuard)
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Get('me')
  @Permissions('company:read')
  getMyCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.findOne(user.companyId!);
  }

  @Patch('me')
  @Permissions('company:manage')
  updateMyCompany(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(user.companyId!, dto);
  }
}
