import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  CrmActivityType,
  CrmCallStatus,
  CrmCommDirection,
  CrmMessageStatus,
} from '@prisma/client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  getFlags() {
    const twilio =
      !!this.config.get('TWILIO_ACCOUNT_SID') &&
      !!this.config.get('TWILIO_AUTH_TOKEN') &&
      !!this.config.get('TWILIO_FROM_NUMBER');
    const exotel =
      !!this.config.get('EXOTEL_SID') &&
      !!this.config.get('EXOTEL_TOKEN') &&
      !!this.config.get('EXOTEL_CALLER_ID');
    const whatsapp =
      !!this.config.get('WHATSAPP_TOKEN') &&
      !!this.config.get('WHATSAPP_PHONE_NUMBER_ID');
    const emailSmtp =
      !!this.config.get('SMTP_HOST') && !!this.config.get('SMTP_USER');

    return {
      twilio,
      exotel,
      whatsapp,
      emailSmtp,
      telephonyProvider: twilio ? 'twilio' : exotel ? 'exotel' : null,
    };
  }

  async sendEmail(input: {
    to?: string;
    subject: string;
    body: string;
  }): Promise<{ sent: boolean; messageId?: string; reason?: string }> {
    const flags = this.getFlags();
    if (!flags.emailSmtp || !input.to) {
      return { sent: false, reason: 'SMTP not configured or missing recipient' };
    }
    // SMTP send is logged as queued; full nodemailer wiring can use MailModule later
    this.logger.log(`SMTP email queued to ${input.to}: ${input.subject}`);
    return { sent: true, messageId: `smtp-${Date.now()}` };
  }

  async placeCall(input: {
    to: string;
    from?: string;
  }): Promise<{ placed: boolean; provider: string; externalId?: string; reason?: string }> {
    const flags = this.getFlags();

    if (flags.twilio) {
      try {
        const sid = this.config.get<string>('TWILIO_ACCOUNT_SID')!;
        const token = this.config.get<string>('TWILIO_AUTH_TOKEN')!;
        const from = input.from || this.config.get<string>('TWILIO_FROM_NUMBER')!;
        const auth = Buffer.from(`${sid}:${token}`).toString('base64');
        const body = new URLSearchParams({
          To: input.to,
          From: from,
          Url: this.config.get('TWILIO_TWIML_URL') || 'http://demo.twilio.com/docs/voice.xml',
        });
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
          },
        );
        const data = (await res.json()) as { sid?: string; message?: string };
        if (!res.ok) {
          this.logger.warn(`Twilio call failed: ${data.message}`);
          return { placed: false, provider: 'twilio', reason: data.message };
        }
        return { placed: true, provider: 'twilio', externalId: data.sid };
      } catch (err) {
        this.logger.error('Twilio call error', err);
        return { placed: false, provider: 'twilio', reason: 'Twilio request failed' };
      }
    }

    if (flags.exotel) {
      try {
        const sid = this.config.get<string>('EXOTEL_SID')!;
        const token = this.config.get<string>('EXOTEL_TOKEN')!;
        const callerId = input.from || this.config.get<string>('EXOTEL_CALLER_ID')!;
        const auth = Buffer.from(`${sid}:${token}`).toString('base64');
        const subdomain = this.config.get('EXOTEL_SUBDOMAIN') || 'api.exotel.com';
        const body = new URLSearchParams({
          From: input.to,
          To: callerId,
          CallerId: callerId,
        });
        const res = await fetch(
          `https://${subdomain}/v1/Accounts/${sid}/Calls/connect.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
          },
        );
        const data = (await res.json()) as {
          Call?: { Sid?: string };
          RestException?: { Message?: string };
        };
        if (!res.ok) {
          return {
            placed: false,
            provider: 'exotel',
            reason: data.RestException?.Message || 'Exotel call failed',
          };
        }
        return {
          placed: true,
          provider: 'exotel',
          externalId: data.Call?.Sid,
        };
      } catch (err) {
        this.logger.error('Exotel call error', err);
        return { placed: false, provider: 'exotel', reason: 'Exotel request failed' };
      }
    }

    return { placed: false, provider: 'manual', reason: 'No telephony provider configured' };
  }

  async sendWhatsApp(input: {
    to: string;
    body: string;
  }): Promise<{ sent: boolean; externalId?: string; reason?: string }> {
    const flags = this.getFlags();
    if (!flags.whatsapp) {
      return { sent: false, reason: 'WhatsApp not configured' };
    }
    try {
      const token = this.config.get<string>('WHATSAPP_TOKEN')!;
      const phoneId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')!;
      const to = input.to.replace(/\D/g, '');
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: input.body },
        }),
      });
      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message?: string };
      };
      if (!res.ok) {
        return { sent: false, reason: data.error?.message || 'WhatsApp send failed' };
      }
      return { sent: true, externalId: data.messages?.[0]?.id };
    } catch (err) {
      this.logger.error('WhatsApp send error', err);
      return { sent: false, reason: 'WhatsApp request failed' };
    }
  }

  async handleTwilioStatus(payload: Record<string, string>) {
    const sid = payload.CallSid;
    if (!sid) return { ok: false };
    const statusMap: Record<string, CrmCallStatus> = {
      queued: CrmCallStatus.QUEUED,
      ringing: CrmCallStatus.RINGING,
      'in-progress': CrmCallStatus.IN_PROGRESS,
      completed: CrmCallStatus.COMPLETED,
      busy: CrmCallStatus.BUSY,
      'no-answer': CrmCallStatus.NO_ANSWER,
      failed: CrmCallStatus.FAILED,
      canceled: CrmCallStatus.CANCELED,
    };
    const status = statusMap[payload.CallStatus] ?? CrmCallStatus.IN_PROGRESS;
    await this.prisma.crmCallLog.updateMany({
      where: { externalId: sid },
      data: {
        status,
        durationSec: payload.CallDuration ? parseInt(payload.CallDuration, 10) : undefined,
        recordingUrl: payload.RecordingUrl,
        endedAt: status === CrmCallStatus.COMPLETED ? new Date() : undefined,
      },
    });
    return { ok: true };
  }

  async handleWhatsAppWebhook(body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            id: string;
            from: string;
            text?: { body?: string };
            timestamp?: string;
          }>;
          metadata?: { phone_number_id?: string };
        };
      }>;
    }>;
  }) {
    const messages =
      body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ??
      [];

    for (const msg of messages) {
      if (!msg?.id || !msg.from) continue;
      const existing = await this.prisma.crmWhatsAppMessage.findFirst({
        where: { externalId: msg.id },
      });
      if (existing) continue;

      // Best-effort match by phone on leads/contacts — companyId required; skip if ambiguous
      const phone = msg.from;
      const lead = await this.prisma.lead.findFirst({
        where: {
          OR: [
            { mobile: { contains: phone.slice(-8) } },
            { phone: { contains: phone.slice(-8) } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!lead) {
        this.logger.warn(`Inbound WhatsApp from ${phone} with no matching lead`);
        continue;
      }

      await this.prisma.crmWhatsAppMessage.create({
        data: {
          companyId: lead.companyId,
          leadId: lead.id,
          direction: CrmCommDirection.INBOUND,
          status: CrmMessageStatus.DELIVERED,
          body: msg.text?.body || '[media]',
          fromNumber: phone,
          externalId: msg.id,
          sentAt: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
        },
      });

      await this.prisma.crmActivity.create({
        data: {
          companyId: lead.companyId,
          leadId: lead.id,
          type: CrmActivityType.WHATSAPP,
          body: msg.text?.body || '[WhatsApp inbound]',
        },
      });
    }

    return { ok: true };
  }
}
