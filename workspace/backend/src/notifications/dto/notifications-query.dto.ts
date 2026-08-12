import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Query flags arrive as strings; normalize before @IsBoolean (and before implicit conversion). */
function toBooleanFlag({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

export class NotificationsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Only unread notifications' })
  @IsOptional()
  @Transform(toBooleanFlag)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: 'If true, only notifications from the last 2 days' })
  @IsOptional()
  @Transform(toBooleanFlag)
  @IsBoolean()
  recent?: boolean;

  @ApiPropertyOptional({ description: 'Override recent window in days (1–30)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  recentDays?: number;
}
