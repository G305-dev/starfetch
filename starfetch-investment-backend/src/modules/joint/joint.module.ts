import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { SmtpConfig } from '../auth/email/smtp-email.provider';
import { JOINT_INVITATION_MAILER } from './email/joint-invitation-mailer';
import { SmtpJointInvitationMailer } from './email/smtp-invitation-mailer';
import { JointMembershipGuard } from './guards/joint-membership.guard';
import { JointController } from './joint.controller';
import { JointInvitationsController } from './joint-invitations.controller';
import { JointMutationService } from './services/joint-mutation.service';
import { JointReadService } from './services/joint-read.service';

/**
 * Phase 3B — Joint Investor module.
 * Step 2: security foundation (guards/utilities).
 * Step 3: read endpoints R1–R4.
 * Step 4: invitations/consent M1–M5 + narrowly-typed invitation mailer
 *         behind JOINT_INVITATION_MAILER (SMTP adapter; fake in tests).
 */
@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [JointController, JointInvitationsController],
  providers: [
    JointMembershipGuard,
    JointReadService,
    JointMutationService,
    {
      provide: JOINT_INVITATION_MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SmtpJointInvitationMailer({
          host: config.get<string>('smtp.host'),
          port: config.get<number>('smtp.port') ?? 1025,
          secure: config.get<boolean>('smtp.secure') ?? false,
          from: config.get<string>('smtp.from') ?? 'Starfetch <no-reply@starfetch.local>',
          user: config.get<string>('smtp.user'),
          pass: config.get<string>('smtp.pass'),
        } as SmtpConfig),
    },
  ],
  exports: [JointMembershipGuard],
})
export class JointModule {}
