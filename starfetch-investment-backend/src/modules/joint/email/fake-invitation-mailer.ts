import { Injectable } from '@nestjs/common';
import { JointInvitationMail, JointInvitationMailer } from './joint-invitation-mailer';

/** Test/fake adapter: records invitation mails; never used in production wiring. */
@Injectable()
export class FakeJointInvitationMailer implements JointInvitationMailer {
  readonly outbox: JointInvitationMail[] = [];

  async sendJointInvitation(mail: JointInvitationMail): Promise<void> {
    this.outbox.push(mail);
  }
}
