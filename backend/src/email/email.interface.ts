/**
 * Email abstraction. Implementations: SMTP (nodemailer), SendGrid, SES.
 * Never log or emit message body or tokens.
 */
export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface IEmailService {
  /** Whether the provider is configured (secrets present). */
  isConfigured(): boolean;
  /** Send email. No-op or log failure only; never throw secrets. */
  send(options: SendEmailOptions): Promise<void>;
}
