import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CrmCallStatus,
  CrmCommDirection,
  CrmMessageStatus,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListCommsQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;
}

export class CreateCrmEmailDto {
  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromAddress?: string;

  @ApiPropertyOptional({ enum: CrmCommDirection })
  @IsOptional()
  @IsEnum(CrmCommDirection)
  direction?: CrmCommDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({ description: 'If true and SMTP configured, attempt send' })
  @IsOptional()
  send?: boolean;
}

export class CreateCrmCallLogDto {
  @ApiPropertyOptional({ enum: CrmCommDirection })
  @IsOptional()
  @IsEnum(CrmCommDirection)
  direction?: CrmCommDirection;

  @ApiPropertyOptional({ enum: CrmCallStatus })
  @IsOptional()
  @IsEnum(CrmCallStatus)
  status?: CrmCallStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({ description: 'If true and telephony configured, place live call' })
  @IsOptional()
  dial?: boolean;
}

export class CreateCrmWhatsAppDto {
  @ApiProperty()
  @IsString()
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromNumber?: string;

  @ApiPropertyOptional({ enum: CrmCommDirection })
  @IsOptional()
  @IsEnum(CrmCommDirection)
  direction?: CrmCommDirection;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional({ description: 'If true and WhatsApp configured, send live' })
  @IsOptional()
  send?: boolean;
}

export class CreateCrmAttachmentDto {
  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsString()
  fileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;
}

export { CrmMessageStatus };
