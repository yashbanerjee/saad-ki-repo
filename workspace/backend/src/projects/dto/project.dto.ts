import {
  IsString,
  IsOptional,
  IsEnum,
  MinLength,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsNumber,
  IsIn,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';

function normalizeTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((s) => s.trim());
  const tags = raw
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 40));
  // unique case-insensitive, keep first casing
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.slice(0, 20);
}

export class CreateProjectDto {
  @ApiPropertyOptional({ description: 'Optional; auto-generated from name when omitted' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  key?: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ type: [String], description: 'e.g. Vedha, F&S, Web, App Dev, ERP' })
  @IsOptional()
  @Transform(({ value }) => normalizeTags(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => normalizeTags(value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ description: 'Project logo URL' })
  @IsOptional()
  @IsString()
  avatar?: string | null;
}

export class AddProjectMemberDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;
}

export class ListProjectsQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter projects that include this tag' })
  @IsOptional()
  @IsString()
  tag?: string;
}

export class CreateMilestoneDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: ['PLANNED', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'DONE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({ enum: ['PLANNED', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsIn(['PLANNED', 'IN_PROGRESS', 'DONE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class CreateClientTaskDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional({ enum: ['TODO', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateClientTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneId?: string | null;

  @ApiPropertyOptional({ enum: ['TODO', 'IN_PROGRESS', 'DONE'] })
  @IsOptional()
  @IsIn(['TODO', 'IN_PROGRESS', 'DONE'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  estimatedHours?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
