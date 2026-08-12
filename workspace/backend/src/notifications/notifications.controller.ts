import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { NotificationsQueryDto } from './dto/notifications-query.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationsQueryDto,
  ) {
    const days = query.recent
      ? 2
      : query.recentDays
        ? Math.min(Math.max(Number(query.recentDays) || 0, 0), 30)
        : undefined;

    return this.notificationsService.findAll(
      user.id,
      Boolean(query.unreadOnly),
      query.page ?? 1,
      query.limit ?? 20,
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
