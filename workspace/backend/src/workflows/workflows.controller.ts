import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import {
  CreateWorkflowDto,
  CreateWorkflowStatusDto,
  CreateWorkflowTransitionDto,
} from './dto/workflow.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('workflows')
@ApiBearerAuth()
@Controller('workflows')
@UseGuards(PermissionsGuard)
export class WorkflowsController {
  constructor(private workflowsService: WorkflowsService) {}

  @Get()
  @Permissions('workflows:read')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.workflowsService.findAll(user.companyId!);
  }

  @Get(':id')
  @Permissions('workflows:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workflowsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('workflows:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkflowDto) {
    return this.workflowsService.create(user.companyId!, dto);
  }

  @Post(':id/statuses')
  @Permissions('workflows:manage')
  addStatus(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkflowStatusDto,
  ) {
    return this.workflowsService.addStatus(id, user.companyId!, dto);
  }

  @Post(':id/transitions')
  @Permissions('workflows:manage')
  addTransition(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkflowTransitionDto,
  ) {
    return this.workflowsService.addTransition(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('workflows:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workflowsService.remove(id, user.companyId!);
  }
}
