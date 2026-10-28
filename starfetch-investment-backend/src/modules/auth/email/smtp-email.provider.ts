import nodemailer from 'nodemailer';
import { EmailProvider, EmailVerificationMail } from './email-provider';

export interface SmtpConfig {
  host?: string;
  port: number;
  secure: boolean;
  from: string;
  user?: string;
  pass?: string;
}

/**
 * Generic SMTP adapter (Nodemailer). Works with any standards-compliant
 * SMTP server, including a local catcher (Mailpit/MailHog) for development:
 *   SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_SECURE=false
 * Never configured with committed credentials.
 */
export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly smtp: SmtpConfig) {}

  async sendEmailVerificationCode(mail: EmailVerificationMail): Promise<void> {
    if (!this.smtp.host) {
      throw new Error('SMTP_HOST is not configured — verification email cannot be delivered.');
    }
    const transporter = nodemailer.createTransport({
      host: this.smtp.host,
      port: this.smtp.port,
      secure: this.smtp.secure,
      auth: this.smtp.user ? { user: this.smtp.user, pass: this.smtp.pass } : undefined,
    });
    await transporter.sendMail({
      from: this.smtp.from,
      to: mail.to,
      subject: 'Your Starfetch verification code',
      text:
        `Your Starfetch verification code is ${mail.code}.\n\n` +
        `It expires in ${mail.expiresInMinutes} minutes and can only be used once.\n\n` +
        'If you did not request this, you can safely ignore this email.',
    });
  }
}
