import { Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrashService } from './trash.service';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('trash')
@ApiBearerAuth()
@Controller('trash')
@UseGuards(PermissionsGuard)
export class TrashController {
  constructor(private trashService: TrashService) {}

  @Get()
  @Permissions('trash:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.trashService.list(user.companyId!, user);
  }

  @Post(':id/restore')
  @Permissions('trash:read')
  restore(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.trashService.restore(id, user.companyId!, user);
  }

  @Delete(':id')
  @Permissions('trash:manage')
  purge(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.trashService.purge(id, user.companyId!, user);
  }
}
