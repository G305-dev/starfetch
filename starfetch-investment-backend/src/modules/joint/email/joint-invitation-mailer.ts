/**
 * Phase 3B Step 4 — Joint invitation notification port.
 *
 * A SEPARATE, narrowly-typed capability from the auth EMAIL_PROVIDER
 * (verification codes): different content, different audit trail, same
 * underlying SMTP transport config. Adapters: SmtpJointInvitationMailer and
 * FakeJointInvitationMailer (tests). Replaceable behind
 * JOINT_INVITATION_MAILER.
 *
 * Contract rules:
 *  - NEVER carries authorization tokens, invitation credentials, or any
 *    financial data — only a plain link to the invitations page.
 *  - Business wording is PROVISIONAL until Starfetch approves the template.
 */
export const JOINT_INVITATION_MAILER = 'JOINT_INVITATION_MAILER';

export interface JointInvitationMail {
  to: string; // full address — required for delivery, NEVER logged unmasked
  inviterFirstName: string;
  accountDisplayName: string;
  invitationsUrl: string; // plain page link; no token/credential embedded
}

export interface JointInvitationMailer {
  sendJointInvitation(mail: JointInvitationMail): Promise<void>;
}
