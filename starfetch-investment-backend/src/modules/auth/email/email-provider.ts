/**
 * Outbound email port for the auth/identity core.
 *
 * Authentication business logic depends ONLY on this interface — never on
 * Nodemailer/SMTP/vendor types. Adapters: SmtpEmailProvider (local/staging,
 * e.g. Mailpit/MailHog) and FakeEmailProvider (automated tests). Production
 * provider choice stays replaceable behind this port. Scope: verification
 * emails only — no marketing/newsletter/general messaging.
 */
export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';

export interface EmailVerificationMail {
  to: string;
  code: string;
  expiresInMinutes: number;
}

export interface EmailProvider {
  sendEmailVerificationCode(mail: EmailVerificationMail): Promise<void>;
}
