import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ClientsService } from '../clients/clients.service';
import { SignSetupNdaDto } from '../clients/dto/client.dto';
import { Public, CurrentUser, AuthenticatedUser } from '../common/decorators';

@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private clientsService: ClientsService) {}

  @Public()
  @Get(':token')
  getSetup(@Param('token') token: string) {
    return this.clientsService.getSetupByToken(token);
  }

  @Post(':token/nda')
  @ApiBearerAuth()
  signNda(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignSetupNdaDto,
    @Req() req: Request,
  ) {
    return this.clientsService.signSetupNda(
      token,
      user.id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
