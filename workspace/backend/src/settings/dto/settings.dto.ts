import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

export class NotificationPrefsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  assignments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  projects?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  comments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clientActivity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailReceive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailDigest?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  push?: boolean;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ type: NotificationPrefsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPrefsDto)
  notifications?: NotificationPrefsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  compactSidebar?: boolean;

  @ApiPropertyOptional({ enum: ['light', 'dark'] })
  @IsOptional()
  @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';
}

export class UpdatePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class SmtpSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  host?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  secure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  user?: string;

  @ApiPropertyOptional({ description: 'Leave blank to keep the saved password' })
  @IsOptional()
  @IsString()
  pass?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clear?: boolean;
}

export class FirebaseSettingsDto {
  @ApiPropertyOptional({ description: 'Paste a Firebase service-account JSON' })
  @IsOptional()
  @IsString()
  serviceAccountJson?: string;

  @ApiPropertyOptional({ description: 'Paste Firebase web app config JSON' })
  @IsOptional()
  @IsString()
  webConfigJson?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientEmail?: string;

  @ApiPropertyOptional({ description: 'Leave blank to keep the saved private key' })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  storageBucket?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messagingSenderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vapidKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clear?: boolean;
}

export class WorkspaceFlagsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clientPortalAccess?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  require2fa?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  auditLogging?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sendNotificationEmails?: boolean;
}

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ type: SmtpSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SmtpSettingsDto)
  smtp?: SmtpSettingsDto;

  @ApiPropertyOptional({ type: FirebaseSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => FirebaseSettingsDto)
  firebase?: FirebaseSettingsDto;

  @ApiPropertyOptional({ type: WorkspaceFlagsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceFlagsDto)
  workspace?: WorkspaceFlagsDto;
}

export class TestSmtpDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  to?: string;
}

export class PushTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token: string;
}

export class UnregisterPushDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  token?: string;
}
