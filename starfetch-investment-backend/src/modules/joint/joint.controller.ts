import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { TransactionsQueryDto } from '../me/dto/transactions-query.dto';
import { JointAccount } from './decorators/joint-account-context.decorator';
import { JointAccountContext, JointMembershipGuard } from './guards/joint-membership.guard';
import { JointReadService } from './services/joint-read.service';
import { JointMutationService } from './services/joint-mutation.service';
import { CreateJointAccountDto, CreateJointInvitationDto } from './dto/joint-invitation.dto';

/**
 * Joint Investor APIs (PROPOSED-JOINT-API-DRAFT v0.5.0-draft.3).
 * Step 3: READ endpoints R1–R4. Step 4: M1 create + M2 (re)invite.
 * Invitee-side consent (M3–M5) lives on JointInvitationsController.
 *
 * Guard stack on account-specific routes (order is mandatory):
 *   AccessTokenGuard (session-aware bearer auth)
 *   → RolesGuard (INVESTOR)
 *   → JointMembershipGuard (PostgreSQL membership proof + verified context).
 * R1 needs no account context — membership rows themselves drive the query.
 *
 * Success envelopes are produced by the global TransformResponseInterceptor
 * ({ data, meta { requestId, … } }); handlers return the draft data payloads.
 */
@Controller()
export class JointController {
  constructor(
    private readonly jointRead: JointReadService,
    private readonly jointMutation: JointMutationService,
  ) {}

  /** R1 — list accounts where the caller is an ACTIVE member. */
  @Get('me/joint-accounts')
  @Roles(UserRole.INVESTOR)
  @UseGuards(AccessTokenGuard, RolesGuard)
  listMyJointAccounts(@Req() req: AuthenticatedRequest) {
    return this.jointRead.listMyJointAccounts(req.principal!.userId);
  }

  /** R2 — account detail + ACTIVE members (404 for unknown/non-member alike). */
  @Get('joint-accounts/:jointAccountId')
  @Roles(UserRole.INVESTOR)
  @UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard)
  getJointAccount(@JointAccount() ctx: JointAccountContext) {
    return this.jointRead.getJointAccount(ctx);
  }

  /** R3 — joint portfolio snapshot (joint-owned portfolio ONLY). */
  @Get('joint-accounts/:jointAccountId/portfolio')
  @Roles(UserRole.INVESTOR)
  @UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard)
  async getJointPortfolio(@JointAccount() ctx: JointAccountContext) {
    const data = await this.jointRead.getJointPortfolio(ctx);
    return { data, meta: { asOf: new Date().toISOString() } };
  }

  /** R4 — joint transaction history (shared pagination semantics). */
  @Get('joint-accounts/:jointAccountId/transactions')
  @Roles(UserRole.INVESTOR)
  @UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard)
  getJointTransactions(
    @JointAccount() ctx: JointAccountContext,
    @Query() query: TransactionsQueryDto,
  ) {
    return this.jointRead.getJointTransactions(ctx, query);
  }

  /**
   * M1 — initiate joint account (201). Guard order:
   * bearer session → INVESTOR → cookie-mutation security (Origin + signed
   * session-bound CSRF) → keyed throttle (5/hour/user — DEV threshold pending
   * business approval). Identity comes from the session principal ONLY.
   */
  @Post('joint-accounts')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({
    bucket: 'joint-account-create',
    limit: 5,
    windowSeconds: 3600,
    identity: 'user',
  })
  @UseGuards(AccessTokenGuard, RolesGuard, CookieMutationGuard, KeyedRateLimitGuard)
  createJointAccount(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateJointAccountDto,
  ) {
    return this.jointMutation.createJointAccount(req.principal!.userId, body);
  }

  /**
   * M2 — (re)invite the second holder (201, anti-enumeration shape). Keyed
   * throttle is per user+account and runs AFTER membership is proven.
   * (5/hour/user/account — DEV threshold pending business approval.)
   */
  @Post('joint-accounts/:jointAccountId/invitations')
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({
    bucket: 'joint-invitation-create',
    limit: 5,
    windowSeconds: 3600,
    identity: 'user+account',
  })
  @UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard, CookieMutationGuard, KeyedRateLimitGuard)
  createInvitation(
    @Req() req: AuthenticatedRequest,
    @JointAccount() ctx: JointAccountContext,
    @Body() body: CreateJointInvitationDto,
  ) {
    return this.jointMutation.createOrReplaceInvitation(ctx, body.email, req.principal!.userId);
  }
}
