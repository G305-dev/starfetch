import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/guards/roles.decorator';
import { KeyedRateLimit } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { JointMutationService } from './services/joint-mutation.service';

/**
 * Phase 3B Step 4 — M3/M4/M5: the invitee-side invitation inbox + consent.
 *
 * Authorization here derives from VERIFIED INVITATION-RECIPIENT identity
 * (server-side User record email match), NOT from pre-existing membership —
 * JointMembershipGuard is therefore intentionally absent on these routes.
 */
@Controller('me/joint-invitations')
export class JointInvitationsController {
  constructor(private readonly jointMutation: JointMutationService) {}

  /** M3 — pending, unexpired invitations addressed to the caller's own email. */
  @Get()
  @Roles(UserRole.INVESTOR)
  @UseGuards(AccessTokenGuard, RolesGuard)
  listMyInvitations(@Req() req: AuthenticatedRequest) {
    return this.jointMutation.listMyInvitations(req.principal!.userId);
  }

  /** M4 — accept (typed consent). 200 + idempotent authorized replay. */
  @Post(':invitationId/accept')
  @HttpCode(200)
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({
    bucket: 'joint-invitation-respond',
    limit: 20, // DEV threshold pending business approval
    windowSeconds: 3600,
    identity: 'user',
  })
  @UseGuards(AccessTokenGuard, RolesGuard, CookieMutationGuard, KeyedRateLimitGuard)
  accept(@Req() req: AuthenticatedRequest, @Param('invitationId') invitationId: string) {
    return this.jointMutation.acceptInvitation({ userId: req.principal!.userId }, invitationId);
  }

  /** M5 — decline (terminal, repeat-safe). Never creates membership. */
  @Post(':invitationId/decline')
  @HttpCode(200)
  @Roles(UserRole.INVESTOR)
  @KeyedRateLimit({
    bucket: 'joint-invitation-respond',
    limit: 20,
    windowSeconds: 3600,
    identity: 'user',
  })
  @UseGuards(AccessTokenGuard, RolesGuard, CookieMutationGuard, KeyedRateLimitGuard)
  decline(@Req() req: AuthenticatedRequest, @Param('invitationId') invitationId: string) {
    return this.jointMutation.declineInvitation({ userId: req.principal!.userId }, invitationId);
  }
}
