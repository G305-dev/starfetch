import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { maskEmail, normalizeEmail } from '../../../common/utils/email-mask';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  JOINT_INVITATION_MAILER,
  JointInvitationMailer,
} from '../email/joint-invitation-mailer';
import { JointAccountContext } from '../guards/joint-membership.guard';
import {
  countActiveMembers,
  lockJointAccount,
  lockJointInvitation,
} from '../joint-membership-tx';

type Tx = Prisma.TransactionClient;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function notFound(message = 'Invitation not found.'): never {
  throw new HttpException({ code: ERROR_CODES.NOT_FOUND, message }, HttpStatus.NOT_FOUND);
}
function gone(): never {
  throw new HttpException(
    { code: ERROR_CODES.GONE, message: 'This invitation has expired.' },
    HttpStatus.GONE,
  );
}
function conflict(message: string): never {
  throw new HttpException({ code: ERROR_CODES.CONFLICT, message }, HttpStatus.CONFLICT);
}

export interface CreateJointAccountInput {
  displayName?: string;
  inviteeEmail: string;
}
export interface CreatedJointAccountView {
  jointAccountId: string;
  displayName: string;
  invitation: { invitationId: string; invitedEmailMasked: string; expiresAt: string; status: 'PENDING' };
}
export interface CreatedInvitationView {
  invitationId: string;
  invitedEmailMasked: string;
  expiresAt: string;
  status: 'PENDING';
}

/**
 * Phase 3B Step 4 — Joint account creation + invitation workflow (M1–M5).
 *
 * Concurrency protocol (docs/backend/joint/03 §3) is obeyed verbatim:
 * joint_accounts row locked FIRST, invitation/member rows SECOND — every path.
 * Capacity (<2) is evaluated INSIDE the account lock; the unique
 * (jointAccountId,userId) pair backstops duplicate membership. Single-live-
 * PENDING invariant per account. Authorized replay returns the same success
 * with zero side effects.
 *
 * Identity rules: email identity is the caller's CURRENT User DB record
 * (normalizedEmail + emailVerifiedAt) — never a JWT claim or request body.
 * Client can never distinguish another person's invitation/account from an
 * unknown one (identical 404; expired surfaces 410 only to the addressee).
 */
@Injectable()
export class JointMutationService {
  private readonly logger = new Logger(JointMutationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(JOINT_INVITATION_MAILER) private readonly mailer: JointInvitationMailer,
  ) {}

  // ── M1 · Create account + initiating member + PENDING invitation ──────────

  async createJointAccount(
    principalUserId: string,
    input: CreateJointAccountInput,
  ): Promise<CreatedJointAccountView> {
    const creator = await this.prisma.user.findUniqueOrThrow({
      where: { id: principalUserId },
      select: {
        id: true,
        normalizedEmail: true,
        emailVerifiedAt: true,
        investorProfile: { select: { firstName: true, lastName: true } },
      },
    });
    if (!creator.emailVerifiedAt) {
      throw new HttpException(
        { code: ERROR_CODES.EMAIL_NOT_VERIFIED, message: 'Verify your email before creating a joint account.' },
        HttpStatus.FORBIDDEN,
      );
    }
    const invitee = normalizeEmail(input.inviteeEmail);
    if (invitee === creator.normalizedEmail) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_FAILED, message: 'You cannot invite yourself.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const holderName =
      `${creator.investorProfile?.firstName ?? ''} ${creator.investorProfile?.lastName ?? ''}`.trim();
    // Draft note: displayName omitted ⇒ holder names server-side. The second
    // holder's name is unknown at this stage (and must not be probed), so the
    // creator's name is the truthful interim label. ≤60 chars guaranteed.
    const displayName = (input.displayName?.trim() || holderName || 'Joint account').slice(0, 60);

    const expiresAt = new Date(Date.now() + this.invitationTtlMs);
    const result = await this.prisma.$transaction(async (tx) => {
      // Single authorization factory: all three writes in ONE transaction.
      const account = await tx.jointAccount.create({
        data: { displayName, createdByUserId: creator.id },
      });
      await tx.jointAccountMember.create({
        data: { jointAccountId: account.id, userId: creator.id }, // single ACTIVE member
      });
      const invitation = await tx.jointAccountInvitation.create({
        data: {
          jointAccountId: account.id,
          invitedEmail: invitee,
          invitedEmailNormalized: invitee,
          invitedByUserId: creator.id,
          expiresAt,
        },
      });
      return { account, invitation };
    });

    // Notification AFTER successful commit; delivery failure preserves the row.
    await this.notifyInvitee({
      to: invitee,
      inviterFirstName: creator.investorProfile?.firstName ?? 'A Starfetch member',
      accountDisplayName: displayName,
    });

    return {
      jointAccountId: result.account.id,
      displayName: result.account.displayName,
      invitation: {
        invitationId: result.invitation.id,
        invitedEmailMasked: maskEmail(input.inviteeEmail),
        expiresAt: result.invitation.expiresAt.toISOString(),
        status: 'PENDING',
      },
    };
  }

  // ── M2 · Invite / safe reinvite (account membership already guard-proven) ─

  async createOrReplaceInvitation(
    ctx: JointAccountContext,
    inviteeEmail: string,
    inviterUserId: string,
  ): Promise<CreatedInvitationView> {
    const invitee = normalizeEmail(inviteeEmail);

    const outcome = await this.prisma.$transaction(async (tx) => {
      await lockJointAccount(tx, ctx.jointAccountId); // parent FIRST

      const memberCount = await countActiveMembers(tx, ctx.jointAccountId);
      if (memberCount >= 2) {
        conflict('This account already has the maximum number of active members.');
      }

      const members = await tx.jointAccountMember.findMany({
        where: { jointAccountId: ctx.jointAccountId },
        select: { user: { select: { normalizedEmail: true } } },
      });
      if (members.some((m) => m.user.normalizedEmail === invitee)) {
        conflict('This person is already a member of this account.');
      }

      const now = new Date();
      const livePending = await tx.jointAccountInvitation.findMany({
        where: { jointAccountId: ctx.jointAccountId, status: 'PENDING', expiresAt: { gt: now } },
        orderBy: { createdAt: 'asc' },
      });
      const sameEmail = livePending.filter((i) => i.invitedEmailNormalized === invitee);
      const otherEmail = livePending.filter((i) => i.invitedEmailNormalized !== invitee);
      if (otherEmail.length > 0) {
        // No approved cancellation policy yet — refuse a second LIVE pending.
        conflict(
          'A pending invitation already exists for this account. It can be replaced only by re-inviting the same email, or you can wait for it to expire or be declined.',
        );
      }
      // SAFE replacement path: revoke existing pending to the SAME email first.
      for (const stale of sameEmail) {
        await tx.jointAccountInvitation.update({
          where: { id: stale.id },
          data: { status: 'REVOKED' },
        });
      }
      const inviter = await tx.user.findUniqueOrThrow({
        where: { id: inviterUserId },
        select: { investorProfile: { select: { firstName: true } } },
      });
      const account = await tx.jointAccount.findUniqueOrThrow({
        where: { id: ctx.jointAccountId },
        select: { displayName: true },
      });
      const invitation = await tx.jointAccountInvitation.create({
        data: {
          jointAccountId: ctx.jointAccountId,
          invitedEmail: invitee,
          invitedEmailNormalized: invitee,
          invitedByUserId: inviterUserId,
          expiresAt: new Date(Date.now() + this.invitationTtlMs),
        },
      });
      return { invitation, displayName: account.displayName, inviterFirstName: inviter.investorProfile?.firstName ?? 'A Starfetch member' };
    });

    await this.notifyInvitee({
      to: invitee,
      inviterFirstName: outcome.inviterFirstName,
      accountDisplayName: outcome.displayName,
    });

    return {
      invitationId: outcome.invitation.id,
      invitedEmailMasked: maskEmail(inviteeEmail),
      expiresAt: outcome.invitation.expiresAt.toISOString(),
      status: 'PENDING',
    };
  }

  // ── M4 · Accept (typed consent; idempotent authorized replay) ─────────────

  async acceptInvitation(
    principal: { userId: string },
    invitationId: string,
  ): Promise<{ jointAccountId: string; joinedAt: string }> {
    if (!UUID_PATTERN.test(invitationId)) notFound();

    return this.prisma.$transaction(async (tx) => {
      // 1. CURRENT identity from DB — verified email required for consent.
      const identity = await tx.user.findUniqueOrThrow({
        where: { id: principal.userId },
        select: { normalizedEmail: true, emailVerifiedAt: true },
      });
      if (!identity.emailVerifiedAt) {
        throw new HttpException(
          { code: ERROR_CODES.EMAIL_NOT_VERIFIED, message: 'Verify your email before responding to invitations.' },
          HttpStatus.FORBIDDEN,
        );
      }

      // 2. Probe invitation (non-authoritative) → account id only.
      const probe = await tx.jointAccountInvitation.findUnique({
        where: { id: invitationId },
        select: { jointAccountId: true },
      });
      if (!probe) notFound();

      // 3. Parent lock FIRST.
      const locked = await lockJointAccount(tx, probe.jointAccountId);
      if (!locked) notFound();

      // 4. Lock + authoritative re-read of the invitation.
      const invitation = await lockJointInvitation(tx, invitationId);
      if (!invitation || invitation.jointAccountId !== locked) notFound();

      // 5. AUTHORIZED REPLAY: same accepted state by the same verified holder.
      if (
        invitation.status === 'ACCEPTED' &&
        invitation.acceptedByUserId === principal.userId &&
        invitation.invitedEmailNormalized === identity.normalizedEmail
      ) {
        const membership = await tx.jointAccountMember.findUnique({
          where: { jointAccountId_userId: { jointAccountId: locked, userId: principal.userId } },
        });
        if (membership) {
          return { jointAccountId: locked, joinedAt: membership.joinedAt.toISOString() };
        }
        notFound(); // degenerate: accepted but membership gone — do not expose
      }

      // Address match BEFORE any status disclosure.
      if (invitation.invitedEmailNormalized !== identity.normalizedEmail) notFound();

      // 6. Status/expiry — 410 revealed to the addressee ONLY.
      if (invitation.status !== 'PENDING') notFound(); // revoked/declined/accepted-by-another
      if (invitation.expiresAt.getTime() <= Date.now()) gone();

      // 7. Capacity INSIDE lock.
      const count = await countActiveMembers(tx, locked);
      if (count >= 2) {
        conflict('This account already has the maximum number of active members.');
      }

      // 8. Exactly one membership (unique pair ON CONFLICT backstop).
      const membership = await tx.jointAccountMember.create({
        data: { jointAccountId: locked, userId: principal.userId },
      });

      // 9. Conditional status flip — must affect exactly one row.
      const flipped = await tx.jointAccountInvitation.updateMany({
        where: { id: invitationId, status: 'PENDING' },
        data: { status: 'ACCEPTED', acceptedByUserId: principal.userId, respondedAt: new Date() },
      });
      if (flipped.count !== 1) {
        throw new HttpException(
          { code: ERROR_CODES.INTERNAL_ERROR, message: 'Invitation state changed concurrently.' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // 10. Revoke any other live PENDING for this account (now full).
      await tx.jointAccountInvitation.updateMany({
        where: { jointAccountId: locked, status: 'PENDING' },
        data: { status: 'REVOKED' },
      });

      return { jointAccountId: locked, joinedAt: membership.joinedAt.toISOString() };
    });
  }

  // ── M5 · Decline (terminal; repeat-safe for the same addressee) ───────────

  async declineInvitation(
    principal: { userId: string },
    invitationId: string,
  ): Promise<{ invitationId: string; status: 'DECLINED' }> {
    if (!UUID_PATTERN.test(invitationId)) notFound();

    return this.prisma.$transaction(async (tx) => {
      // 1. CURRENT identity from DB — consent decisions (decline included)
      //    require the same verified-email proof as acceptance. An unverified
      //    caller is refused 403 EMAIL_NOT_VERIFIED BEFORE any invitation
      //    probing, so no account/invitation existence signal can leak.
      const identity = await tx.user.findUniqueOrThrow({
        where: { id: principal.userId },
        select: { normalizedEmail: true, emailVerifiedAt: true },
      });
      if (!identity.emailVerifiedAt) {
        throw new HttpException(
          { code: ERROR_CODES.EMAIL_NOT_VERIFIED, message: 'Verify your email before responding to invitations.' },
          HttpStatus.FORBIDDEN,
        );
      }
      const probe = await tx.jointAccountInvitation.findUnique({
        where: { id: invitationId },
        select: { jointAccountId: true },
      });
      if (!probe) notFound();

      const locked = await lockJointAccount(tx, probe.jointAccountId);
      if (!locked) notFound();

      const invitation = await lockJointInvitation(tx, invitationId);
      if (!invitation || invitation.jointAccountId !== locked) notFound();
      if (invitation.invitedEmailNormalized !== identity.normalizedEmail) notFound();

      // Idempotent repeat: already DECLINED by (and addressed to) this caller.
      if (invitation.status === 'DECLINED') {
        return { invitationId, status: 'DECLINED' };
      }
      if (invitation.status !== 'PENDING') notFound(); // revoked or accepted — as unknown
      if (invitation.expiresAt.getTime() <= Date.now()) gone();

      const flipped = await tx.jointAccountInvitation.updateMany({
        where: { id: invitationId, status: 'PENDING' },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });
      if (flipped.count !== 1) {
        throw new HttpException(
          { code: ERROR_CODES.INTERNAL_ERROR, message: 'Invitation state changed concurrently.' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      return { invitationId, status: 'DECLINED' };
    });
  }

  // ── M3 · My pending invitation inbox (identity from DB record only) ───────

  async listMyInvitations(principalUserId: string): Promise<
    Array<{
      invitationId: string;
      jointAccountId: string;
      accountDisplayName: string;
      inviterFirstName: string;
      expiresAt: string;
      sentAt: string;
    }>
  > {
    const identity = await this.prisma.user.findUniqueOrThrow({
      where: { id: principalUserId },
      select: { normalizedEmail: true, emailVerifiedAt: true },
    });
    if (!identity.emailVerifiedAt) {
      throw new HttpException(
        { code: ERROR_CODES.EMAIL_NOT_VERIFIED, message: 'Verify your email to view invitations.' },
        HttpStatus.FORBIDDEN,
      );
    }
    const rows = await this.prisma.jointAccountInvitation.findMany({
      where: {
        invitedEmailNormalized: identity.normalizedEmail,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' }, // newest first
      select: {
        id: true,
        jointAccountId: true,
        expiresAt: true,
        createdAt: true,
        jointAccount: { select: { displayName: true } },
        invitedBy: { select: { investorProfile: { select: { firstName: true } } } },
      },
    });
    return rows.map((r) => ({
      invitationId: r.id,
      jointAccountId: r.jointAccountId,
      accountDisplayName: r.jointAccount.displayName,
      inviterFirstName: r.invitedBy.investorProfile?.firstName ?? '',
      expiresAt: r.expiresAt.toISOString(),
      sentAt: r.createdAt.toISOString(),
    }));
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private get invitationTtlMs(): number {
    const hours = this.config.get<number>('joint.invitationTtlHours') ?? 168;
    return hours * 3600_000;
  }

  /**
   * Delivery is attempted AFTER the commit. Failure keeps the invitation row;
   * the response claims nothing about email delivery (the contract carries no
   * delivery field). Retry path today: re-invite (safe replacement) — queued
   * background retry is a possible later enhancement pending approval.
   */
  /**
   * Recognized network/SMTP transport error codes (Node + Nodemailer). These
   * are protocol-level constants — SAFE to log. A fabricated uppercase string
   * (e.g. injected identifiers) is NOT allowed through: unknown values are
   * classified as 'send_failed'.
   */
  private static readonly SAFE_TRANSPORT_ERROR_CODES = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ECONNABORTED',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
    'ENOTFOUND',
    'EPROTO',
    'ESOCKET',
    'EAUTH',
    'EENVELOPE',
    'EMESSAGE',
  ]);

  /**
   * Classifies a mailer failure into a SAFE log category against the explicit
   * allowlist above; everything else (incl. arbitrary message text or made-up
   * uppercase 'codes') collapses to 'send_failed'.
   */
  private static deliveryCategory(err: unknown): string {
    const code = (err as { code?: unknown } | null | undefined)?.code;
    if (typeof code === 'string' && JointMutationService.SAFE_TRANSPORT_ERROR_CODES.has(code)) {
      return code;
    }
    const name = (err as { name?: unknown } | null | undefined)?.name;
    if (name === 'AggregateError' || name === 'TimeoutError') return name;
    return 'send_failed';
  }

  private async notifyInvitee(mail: {
    to: string;
    inviterFirstName: string;
    accountDisplayName: string;
  }): Promise<void> {
    const invitationsUrl =
      this.config.get<string>('joint.invitationsUrl') ?? 'http://localhost:3000/login';
    try {
      await this.mailer.sendJointInvitation({ ...mail, invitationsUrl });
    } catch (err) {
      // Transport exceptions may embed addresses, credentials, server banners
      // or other unverified external data — the raw message/stack is NEVER
      // logged. Only a safe, structured category + masked recipient.
      this.logger.warn(
        `Joint invitation delivery failed [category=${JointMutationService.deliveryCategory(err)} recipient=${maskEmail(
          mail.to,
        )}] — invitation persisted; the holder can re-invite (safe replacement).`,
      );
    }
  }
}
