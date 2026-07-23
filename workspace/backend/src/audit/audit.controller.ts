import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(PermissionsGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @Permissions('audit:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.auditService.findByCompany(
      user.companyId!,
      query.page,
      query.limit,
    );
  }
}
