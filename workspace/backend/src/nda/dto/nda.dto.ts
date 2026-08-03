import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SignatureType } from '@prisma/client';

export class CreateNdaTemplateDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Full NDA body. Use {{companyName}}, {{clientName}}, {{date}}' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Optional client this custom template is for' })
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class UpdateNdaTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignNdaDto {
  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiPropertyOptional({ description: 'Existing template id. Omit if creating custom content.' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Custom NDA body for this client' })
  @IsOptional()
  @IsString()
  customContent?: string;

  @ApiPropertyOptional({ description: 'Title when creating a custom client template' })
  @IsOptional()
  @IsString()
  customTitle?: string;
}

export class PreviewNdaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
}

export class SignNdaDto {
  @ApiProperty({ enum: SignatureType })
  @IsEnum(SignatureType)
  signatureType: SignatureType;

  @ApiProperty()
  @IsString()
  signatureData: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;
}

export class RejectNdaDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
