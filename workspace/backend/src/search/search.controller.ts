import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { SearchService } from './search.service';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';

class SearchQueryDto {
  @IsString()
  @MinLength(2)
  q: string;
}

@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(PermissionsGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @Permissions('search:read')
  search(@CurrentUser() user: AuthenticatedUser, @Query() query: SearchQueryDto) {
    return this.searchService.globalSearch(user.companyId!, query.q);
  }
}
