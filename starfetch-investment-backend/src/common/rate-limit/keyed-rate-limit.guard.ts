import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '../errors/error-codes';
import type { AuthenticatedRequest } from '../types/auth-principal';
import type { JointAccountContext } from '../../modules/joint/guards/joint-membership.guard';
import {
  KEYED_RATE_LIMIT_KEY,
  KeyedRateLimitIdentity,
  KeyedRateLimitMeta,
} from './keyed-rate-limit.decorator';
import { RATE_LIMITER, RateLimiter } from './rate-limiter';

/**
 * Authenticated, post-authorization rate limiting (Phase 3B Step 2).
 *
 * WHY A SEPARATE GUARD: the existing global `RateLimitGuard` is registered via
 * APP_GUARD and therefore executes BEFORE controller-level authentication
 * guards; it correctly does per-IP throttling but can never safely see the
 * principal. This guard is @UseGuards-attached AFTER AccessTokenGuard / RolesGuard
 * / JointMembershipGuard, so keys are derived ONLY from already-validated
 * identity:
 *   identity 'user'         → `${bucket}:user:${principal.userId}`
 *   identity 'user+account' → same + `acct:${jointContext.jointAccountId}`,
 *                             requiring JointMembershipGuard to have run first.
 *
 * FAIL-CLOSED: a missing principal (or missing joint context for
 * 'user+account') is a wiring error — it surfaces 500 INTERNAL_ERROR, never a
 * silent bypass and never an unauthenticated identity being trusted.
 *
 * LIMITS (process-local in-memory adapter, preserved interface): limits are
 * per-server-instance and fragment under horizontal scaling — MVP single
 * instance acceptable; the RATE_LIMITER DI token allows a shared store later.
 */
@Injectable()
export class KeyedRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<KeyedRateLimitMeta>(
      KEYED_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;
    // Mirrors the existing guard convention: automated tests disable
    // throttling via config; production keeps it enabled.
    if (this.config.get<boolean>('auth.rateLimit.enabled') === false) return true;

    const req = context.switchToHttp().getRequest<
      AuthenticatedRequest & { jointContext?: JointAccountContext }
    >();

    const principal = req.principal;
    if (!principal) {
      // Never infer identity from untrusted input; never skip throttling.
      throw new HttpException(
        { code: ERROR_CODES.INTERNAL_ERROR, message: 'Rate-limit identity unavailable.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let key = `${meta.bucket}:user:${principal.userId}`;
    if ((meta.identity as KeyedRateLimitIdentity) === 'user+account') {
      if (!req.jointContext) {
        throw new HttpException(
          { code: ERROR_CODES.INTERNAL_ERROR, message: 'Rate-limit account context unavailable.' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      key += `:acct:${req.jointContext.jointAccountId}`;
    }

    const result = this.limiter.tryConsume(key, meta.limit, meta.windowSeconds);
    if (!result.allowed) {
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests — please try again later.',
          context: { retryAfterSeconds: result.retryAfterSeconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
