import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SignatureType } from '@prisma/client';

export class CreateNdaTemplateDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  content: string;
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
