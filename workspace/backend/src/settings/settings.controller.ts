import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { SettingsService } from './settings.service';
import { CurrentUser, AuthenticatedUser } from '../common/decorators';
import {
  PushTokenDto,
  TestSmtpDto,
  UnregisterPushDto,
  UpdateOrganizationDto,
  UpdatePasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateWorkspaceDto,
} from './dto/settings.dto';

const brandMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
};

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

  @Patch('organization')
  updateOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.settings.updateOrganization(user, dto);
  }

  @Post('organization/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', brandMulterOptions))
  uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Please choose a logo image');
    return this.settings.uploadOrganizationAsset(user, 'logo', file);
  }

  @Post('organization/favicon')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', brandMulterOptions))
  uploadFavicon(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Please choose a favicon image');
    return this.settings.uploadOrganizationAsset(user, 'favicon', file);
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
