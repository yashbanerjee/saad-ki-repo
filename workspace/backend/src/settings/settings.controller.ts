import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';
import {
  PushTokenDto,
  TestSmtpDto,
  UnregisterPushDto,
  UpdatePasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateWorkspaceDto,
} from './dto/settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.get(user);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.settings.updateProfile(user, dto);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.settings.updatePreferences(user, dto);
  }

  @Patch('password')
  updatePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePasswordDto) {
    return this.settings.updatePassword(user, dto);
  }

  @Patch('workspace')
  updateWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.settings.updateWorkspace(user, dto);
  }

  @Post('smtp/test')
  testSmtp(@CurrentUser() user: AuthenticatedUser, @Body() dto: TestSmtpDto) {
    return this.settings.testSmtp(user, dto.to);
  }

  @Post('push/test')
  testPush(@CurrentUser() user: AuthenticatedUser) {
    return this.settings.testPush(user);
  }

  @Post('push/register')
  registerPush(@CurrentUser() user: AuthenticatedUser, @Body() dto: PushTokenDto) {
    return this.settings.registerPushToken(user, dto.token);
  }

  @Post('push/unregister')
  unregisterPush(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnregisterPushDto,
  ) {
    return this.settings.unregisterPushToken(user, dto.token);
  }
}
