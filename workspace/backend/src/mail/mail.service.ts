import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: false,
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', 'TaskFlow <noreply@taskflow.io>'),
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error);
      throw error;
    }
  }

  async sendVerificationEmail(to: string, token: string) {
    const url = `${this.config.get('CORS_ORIGIN')}/verify-email?token=${token}`;
    return this.sendMail(
      to,
      'Verify your TaskFlow email',
      `<p>Click <a href="${url}">here</a> to verify your email address.</p>`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const url = `${this.config.get('CORS_ORIGIN')}/reset-password?token=${token}`;
    return this.sendMail(
      to,
      'Reset your TaskFlow password',
      `<p>Click <a href="${url}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    );
  }

  async sendInvitationEmail(to: string, token: string, companyName: string) {
    const url = `${this.config.get('CORS_ORIGIN')}/accept-invite?token=${token}`;
    return this.sendMail(
      to,
      `You're invited to join ${companyName} on TaskFlow`,
      `<p>You've been invited to join <strong>${companyName}</strong>. <a href="${url}">Accept invitation</a></p>`,
    );
  }
}
