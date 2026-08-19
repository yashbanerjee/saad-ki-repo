import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { isSmtpReady, parseCompanySettings, type SmtpSettings } from '../common/workspace-settings';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly companyCache = new Map<
    string,
    { key: string; transporter: nodemailer.Transporter; from: string }
  >();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  hasEnvSmtp() {
    return Boolean(this.config.get<string>('SMTP_HOST'));
  }

  invalidateCompany(companyId: string) {
    this.companyCache.delete(companyId);
  }

  async sendMail(to: string, subject: string, html: string, companyId?: string | null) {
    const smtp = await this.resolveSmtp(companyId);
    if (!smtp) {
      this.logger.warn(`No SMTP configured — skipped email to ${to}: ${subject}`);
      throw new BadRequestException('SMTP is not configured');
    }
    const transporter = this.transporterFor(smtp, companyId);
    try {
      await transporter.sendMail({
        from: smtp.from,
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  async sendTestEmail(companyId: string, to: string) {
    const smtp = await this.resolveSmtp(companyId);
    if (!smtp) throw new BadRequestException('SMTP is not configured');
    const transporter = this.transporterFor(smtp, companyId);
    try {
      await transporter.verify();
    } catch (error) {
      this.logger.error('SMTP verify failed', error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Could not connect to the SMTP server',
      );
    }
    await transporter.sendMail({
      from: smtp.from,
      to,
      subject: 'TaskFlow SMTP test',
      html: `<p>This is a test email from TaskFlow. Your workspace SMTP settings are working.</p>`,
    });
  }

  async sendVerificationEmail(to: string, token: string, companyId?: string | null) {
    const url = `${this.config.get('CORS_ORIGIN')}/verify-email?token=${token}`;
    return this.sendMail(
      to,
      'Verify your TaskFlow email',
      `<p>Click <a href="${url}">here</a> to verify your email address.</p>`,
      companyId,
    );
  }

  async sendPasswordResetEmail(to: string, token: string, companyId?: string | null) {
    const url = `${this.config.get('CORS_ORIGIN')}/reset-password?token=${token}`;
    return this.sendMail(
      to,
      'Reset your TaskFlow password',
      `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
      companyId,
    );
  }

  async sendInvitationEmail(
    to: string,
    token: string,
    companyName: string,
    companyId?: string | null,
  ) {
    const url = `${this.config.get('CORS_ORIGIN')}/accept-invite?token=${token}`;
    return this.sendMail(
      to,
      `You're invited to join ${companyName} on TaskFlow`,
      `<p>You've been invited to join <strong>${companyName}</strong>. <a href="${url}">Accept invitation</a></p>`,
      companyId,
    );
  }

  async resolveSmtp(companyId?: string | null): Promise<SmtpSettings | null> {
    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { settings: true },
      });
      if (company) {
        const smtp = parseCompanySettings(company.settings).smtp;
        if (isSmtpReady(smtp)) return smtp;
      }
    }
    return this.envSmtp();
  }

  private envSmtp(): SmtpSettings | null {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return null;
    const port = Number(this.config.get('SMTP_PORT') ?? 587);
    return {
      host,
      port,
      secure: this.config.get('SMTP_SECURE') === 'true' || port === 465,
      user: this.config.get<string>('SMTP_USER') || '',
      pass: this.config.get<string>('SMTP_PASS') || '',
      from: this.config.get<string>('SMTP_FROM') || 'TaskFlow <noreply@taskflow.io>',
    };
  }

  private transporterFor(smtp: SmtpSettings, companyId?: string | null) {
    const key = JSON.stringify({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user,
      pass: smtp.pass,
      from: smtp.from,
    });
    if (companyId) {
      const cached = this.companyCache.get(companyId);
      if (cached?.key === key) return cached.transporter;
    }
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure || smtp.port === 465,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
    if (companyId) {
      this.companyCache.set(companyId, { key, transporter, from: smtp.from });
    }
    return transporter;
  }
}
