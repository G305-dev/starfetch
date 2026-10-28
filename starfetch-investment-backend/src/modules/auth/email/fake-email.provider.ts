import { Injectable } from '@nestjs/common';
import { EmailProvider, EmailVerificationMail } from './email-provider';

/**
 * Test/fake adapter: records outgoing verification mails in memory instead of
 * sending. Exposes the recorded outbox so automated tests can complete flows
 * without a real SMTP server. Never used in production wiring.
 */
@Injectable()
export class FakeEmailProvider implements EmailProvider {
  readonly outbox: EmailVerificationMail[] = [];

  async sendEmailVerificationCode(mail: EmailVerificationMail): Promise<void> {
    this.outbox.push(mail);
  }

  latestFor(to: string): EmailVerificationMail | undefined {
    for (let i = this.outbox.length - 1; i >= 0; i -= 1) {
      if (this.outbox[i].to === to) return this.outbox[i];
    }
    return undefined;
  }
}
