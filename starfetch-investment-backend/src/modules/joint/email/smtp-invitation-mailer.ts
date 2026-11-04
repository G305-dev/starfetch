import nodemailer from 'nodemailer';
import { SmtpConfig } from '../../auth/email/smtp-email.provider';
import { JointInvitationMail, JointInvitationMailer } from './joint-invitation-mailer';

/**
 * SMTP adapter for joint invitation notifications (reuses the approved SMTP
 * transport configuration; no new external email provider is introduced).
 * Wording is provisional pending Starfetch template approval.
 */
export class SmtpJointInvitationMailer implements JointInvitationMailer {
  constructor(private readonly smtp: SmtpConfig) {}

  async sendJointInvitation(mail: JointInvitationMail): Promise<void> {
    if (!this.smtp.host) {
      throw new Error('SMTP_HOST is not configured — invitation email cannot be delivered.');
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
      subject: `You've been invited to a Starfetch joint account`, // PROVISIONAL wording
      text:
        `${mail.inviterFirstName} has invited you to join the joint account ` +
        `"${mail.accountDisplayName}" on Starfetch.\n\n` +
        `Sign in to view and respond to the invitation: ${mail.invitationsUrl}\n\n` +
        'If you were not expecting this, you can safely ignore this email — no ' +
        'account access is granted until you explicitly accept while signed in.',
    });
  }
}
