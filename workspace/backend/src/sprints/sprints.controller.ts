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
import { SprintsService } from './sprints.service';
import { CreateSprintDto, UpdateSprintDto } from './dto/sprint.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('sprints')
@ApiBearerAuth()
@Controller('sprints')
@UseGuards(PermissionsGuard)
export class SprintsController {
  constructor(private sprintsService: SprintsService) {}

  @Get()
  @Permissions('sprints:read')
  findByProject(
    @Query('projectId', ParseCuidPipe) projectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sprintsService.findByProject(projectId, user.companyId!);
  }

  @Get(':id')
  @Permissions('sprints:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sprintsService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('sprints:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSprintDto) {
    return this.sprintsService.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('sprints:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprintsService.update(id, user.companyId!, dto);
  }

  @Post(':id/start')
  @Permissions('sprints:manage')
  start(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sprintsService.start(id, user.companyId!);
  }

  @Post(':id/complete')
  @Permissions('sprints:manage')
  complete(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sprintsService.complete(id, user.companyId!);
  }

  @Delete(':id')
  @Permissions('sprints:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sprintsService.remove(id, user.companyId!);
  }
}
