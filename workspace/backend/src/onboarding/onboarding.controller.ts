import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OnboardingService } from './onboarding.service';
import {
  CreateFormDto,
  UpdateFormDto,
  CreateFormPageDto,
  CreateFormFieldDto,
  SubmitFormDto,
} from './dto/onboarding.dto';
import { CurrentUser, AuthenticatedUser, Permissions, Public } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get('forms')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:read')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.findAll(user.companyId!);
  }

  @Get('forms/:id')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.findOne(id, user.companyId!);
  }

  @Post('forms')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFormDto) {
    return this.onboardingService.create(user.companyId!, user.id, dto);
  }

  @Patch('forms/:id')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFormDto,
  ) {
    return this.onboardingService.update(id, user.companyId!, dto);
  }

  @Post('forms/:id/publish')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:manage')
  publish(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.publish(id, user.companyId!);
  }

  @Post('forms/:id/unpublish')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:manage')
  unpublish(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.unpublish(id, user.companyId!);
  }

  @Post('forms/:id/pages')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:manage')
  addPage(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFormPageDto,
  ) {
    return this.onboardingService.addPage(id, user.companyId!, dto);
  }

  @Post('forms/:id/fields')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:manage')
  addField(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFormFieldDto,
  ) {
    return this.onboardingService.addField(id, user.companyId!, dto);
  }

  @Get('forms/:id/submissions')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:read')
  getSubmissions(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.getSubmissions(id, user.companyId!);
  }

  @Delete('forms/:id')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('onboarding:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.onboardingService.remove(id, user.companyId!);
  }

  @Public()
  @Get('public/:secureToken')
  getPublicForm(@Param('secureToken') secureToken: string) {
    return this.onboardingService.findByToken(secureToken);
  }

  @Public()
  @Post('public/:secureToken/submit')
  submitPublic(
    @Param('secureToken') secureToken: string,
    @Body() dto: SubmitFormDto,
    @Req() req: Request,
  ) {
    return this.onboardingService.submitByToken(
      secureToken,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
