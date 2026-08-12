import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationDto,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('recent') recent?: string,
    @Query('recentDays') recentDays?: string,
  ) {
    const days =
      recent === 'true'
        ? 2
        : recentDays
          ? Math.min(Math.max(Number(recentDays) || 0, 0), 30)
          : undefined;
    return this.notificationsService.findAll(
      user.id,
      unreadOnly === 'true',
      query.page,
      query.limit,
      days ? { recentDays: days } : undefined,
    );
  }

  @Patch(':id/read')
  markRead(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }
}
