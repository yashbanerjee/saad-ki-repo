import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IssuesService } from './issues.service';
import {
  CreateIssueDto,
  UpdateIssueDto,
  TransitionIssueDto,
  CreateCommentDto,
  IssueFilterDto,
} from './dto/issue.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('issues')
@ApiBearerAuth()
@Controller('issues')
@UseGuards(PermissionsGuard)
export class IssuesController {
  constructor(private issuesService: IssuesService) {}

  @Get()
  @Permissions('issues:read')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() filters: IssueFilterDto,
    @Query() pagination: PaginationDto,
  ) {
    return this.issuesService.findAll(user.companyId!, filters, pagination.page, pagination.limit);
  }

  @Get(':id')
  @Permissions('issues:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.issuesService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('issues:create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateIssueDto) {
    return this.issuesService.create(user.companyId!, user.id, dto);
  }

  @Patch(':id')
  @Permissions('issues:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateIssueDto,
  ) {
    return this.issuesService.update(id, user.companyId!, user.id, dto);
  }

  @Post(':id/transition')
  @Permissions('issues:manage')
  transition(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TransitionIssueDto,
  ) {
    return this.issuesService.transition(id, user.companyId!, user.id, dto);
  }

  @Delete(':id')
  @Permissions('issues:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.issuesService.remove(id, user.companyId!);
  }

  @Post(':id/comments')
  @Permissions('issues:manage')
  addComment(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommentDto,
  ) {
    return this.issuesService.addComment(id, user.companyId!, user.id, dto);
  }

  @Post(':id/watchers')
  @Permissions('issues:read')
  addWatcher(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.issuesService.addWatcher(id, user.companyId!, user.id);
  }

  @Delete(':id/watchers/me')
  @Permissions('issues:read')
  removeWatcher(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.issuesService.removeWatcher(id, user.companyId!, user.id);
  }
}
