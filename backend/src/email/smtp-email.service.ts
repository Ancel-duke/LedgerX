import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { StructuredLoggerService } from '../common/structured-logger/structured-logger.service';
import { IEmailService, SendEmailOptions } from './email.interface';
import { getPasswordResetHtml, getPasswordResetText } from './templates/password-reset.template';

/**
 * SMTP email implementation. Works with SendGrid SMTP relay, SES SMTP, or any SMTP.
 * Never logs message body or tokens.
 */
@Injectable()
export class SmtpEmailService implements IEmailService {
  private readonly logger = new StructuredLoggerService(SmtpEmailService.name);
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('email.from') ?? 'noreply@ledgerx.local';
    const host = this.configService.get<string>('email.smtp.host');
    const port = this.configService.get<number>('email.smtp.port');
    const user = this.configService.get<string>('email.smtp.user');
    const pass = this.configService.get<string>('email.smtp.pass');
    const secure = this.configService.get<boolean>('email.smtp.secure');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port ?? 587,
        secure: secure ?? false,
        auth: { user, pass },
      });
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.transporter) {
      return;
    }
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.error('Email send failed', { to: options.to, subject: options.subject }, e);
    }
  }

  /** Send password reset email. resetLink must contain the token; never log or store the link. */
  async sendPasswordResetLink(to: string, resetLink: string): Promise<void> {
    await this.send({
      to,
      subject: 'Reset your password',
      text: getPasswordResetText(resetLink),
      html: getPasswordResetHtml(resetLink),
    });
  }
}
