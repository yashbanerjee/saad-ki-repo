import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsObject,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FieldType } from '@prisma/client';

export class CreateFormDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFormDto {
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
  @IsObject()
  settings?: Record<string, unknown>;
}

export class CreateFormPageDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;
}

export class CreateFormFieldDto {
  @ApiProperty({ enum: FieldType })
  @IsString()
  type: FieldType | string;

  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sectionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  options?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;
}

export class SaveFormFieldsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateFormFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFormFieldDto)
  fields: CreateFormFieldDto[];

  @ApiPropertyOptional({ description: 'Publish form so the public client link works' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

export class SubmitFormDto {
  @ApiProperty()
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;
}
