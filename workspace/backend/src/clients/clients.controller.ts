import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import {
  AssignOnboardingFormDto,
  CreateClientDto,
  CreateClientLoginDto,
  CreateClientOnboardingFormDto,
  ListClientsQueryDto,
  UpdateClientDto,
} from './dto/client.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('clients')
@UseGuards(PermissionsGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  @Permissions('clients:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ListClientsQueryDto) {
    return this.clientsService.findAll(user.companyId!, query);
  }

  @Get(':id')
  @Permissions('clients:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.findOne(id, user.companyId!);
  }

  @Get(':id/onboarding-forms')
  @Permissions('clients:read')
  listOnboardingForms(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.listOnboardingForms(id, user.companyId!);
  }

  @Post()
  @Permissions('clients:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(user.companyId!, user.id, dto);
  }

  @Post(':id/onboarding-forms/assign')
  @Permissions('clients:manage')
  assignForm(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignOnboardingFormDto,
  ) {
    return this.clientsService.assignOnboardingForm(id, user.companyId!, user.id, dto);
  }

  @Post(':id/onboarding-forms')
  @Permissions('clients:manage')
  createFormForClient(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientOnboardingFormDto,
  ) {
    return this.clientsService.createOnboardingFormForClient(
      id,
      user.companyId!,
      user.id,
      dto,
    );
  }

  @Delete(':id/onboarding-forms/:assignmentId')
  @Permissions('clients:manage')
  unassignForm(
    @Param('id', ParseCuidPipe) id: string,
    @Param('assignmentId', ParseCuidPipe) assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clientsService.unassignOnboardingForm(id, user.companyId!, assignmentId);
  }

  @Post(':id/create-login')
  @Permissions('clients:manage')
  createLogin(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientLoginDto,
  ) {
    return this.clientsService.createLogin(id, user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('clients:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('clients:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clientsService.remove(id, user.companyId!);
  }
}
