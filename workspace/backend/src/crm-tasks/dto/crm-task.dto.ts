import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrmTaskPriority, CrmTaskStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListCrmTasksQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CrmTaskStatus })
  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class CreateCrmTaskDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CrmTaskStatus })
  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

  @ApiPropertyOptional({ enum: CrmTaskPriority })
  @IsOptional()
  @IsEnum(CrmTaskPriority)
  priority?: CrmTaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;

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

export class UpdateCrmTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: CrmTaskStatus })
  @IsOptional()
  @IsEnum(CrmTaskStatus)
  status?: CrmTaskStatus;

  @ApiPropertyOptional({ enum: CrmTaskPriority })
  @IsOptional()
  @IsEnum(CrmTaskPriority)
  priority?: CrmTaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedToId?: string;
}
