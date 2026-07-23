import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { NdaService } from './nda.service';
import { CreateNdaTemplateDto, SignNdaDto, RejectNdaDto } from './dto/nda.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('nda')
@ApiBearerAuth()
@Controller('nda')
@UseGuards(PermissionsGuard)
export class NdaController {
  constructor(private ndaService: NdaService) {}

  @Get('templates')
  @Permissions('nda:read')
  findTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.ndaService.findTemplates(user.companyId!);
  }

  @Post('templates')
  @Permissions('nda:manage')
  createTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateNdaTemplateDto) {
    return this.ndaService.createTemplate(user.companyId!, dto);
  }

  @Get('templates/:id')
  @Permissions('nda:read')
  findTemplate(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ndaService.findTemplate(id, user.companyId!);
  }

  @Get('templates/:id/signatures')
  @Permissions('nda:read')
  getSignatures(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ndaService.getSignatures(id, user.companyId!);
  }

  @Post('templates/:id/sign')
  @Permissions('nda:manage')
  sign(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignNdaDto,
    @Req() req: Request,
  ) {
    return this.ndaService.sign(id, user.companyId!, user.id, dto, req.ip, req.headers['user-agent']);
  }

  @Post('signatures/:id/reject')
  @Permissions('nda:manage')
  reject(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectNdaDto,
  ) {
    return this.ndaService.reject(id, user.companyId!, user.id, dto);
  }
}
