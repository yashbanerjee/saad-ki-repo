import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { CurrentUser, AuthenticatedUser, Permissions, Public } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('integrations')
@Controller()
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get('integrations/status')
  @ApiBearerAuth()
  @UseGuards(PermissionsGuard)
  @Permissions('leads:read')
  status(@CurrentUser() _user: AuthenticatedUser) {
    return this.integrationsService.getFlags();
  }

  @Public()
  @Post('webhooks/twilio')
  twilioWebhook(@Body() body: Record<string, string>) {
    return this.integrationsService.handleTwilioStatus(body);
  }

  @Public()
  @Post('webhooks/exotel')
  exotelWebhook(@Body() body: Record<string, string>) {
    // Exotel status payloads vary; reuse Twilio-like mapping via CallSid/Status if present
    return this.integrationsService.handleTwilioStatus({
      CallSid: body.CallSid || body.CallSid || body.Sid,
      CallStatus: body.Status || body.DialCallStatus || body.CallStatus,
      CallDuration: body.Duration || body.DialCallDuration,
      RecordingUrl: body.RecordingUrl,
    });
  }

  @Public()
  @Get('webhooks/whatsapp')
  whatsappVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && token && expected && token === expected) {
      return Number(challenge) || challenge;
    }
    return { ok: false };
  }

  @Public()
  @Post('webhooks/whatsapp')
  whatsappWebhook(
    @Body() body: Parameters<IntegrationsService['handleWhatsAppWebhook']>[0],
    @Headers('x-hub-signature-256') _sig?: string,
  ) {
    return this.integrationsService.handleWhatsAppWebhook(body);
  }
}
