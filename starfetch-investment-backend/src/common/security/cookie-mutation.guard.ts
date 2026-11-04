import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ERROR_CODES } from '../errors/error-codes';
import { AuthenticatedRequest } from '../types/auth-principal';
import { CookieOriginGuard } from '../../modules/auth/guards/cookie-origin.guard';
import { CsrfService } from '../../modules/auth/services/csrf.service';

/**
 * Cookie-mutation security posture for future authenticated state-changing
 * endpoints (created for Phase 3B joint flows; generic by design).
 *
 * MUST run AFTER `AccessTokenGuard` (bearer auth + session validity). It then
 * requires, in order:
 *   1. `CookieOriginGuard` policy — a present browser Origin/Referer must match
 *      the CORS allowlist. NOTE: origin validation is a browser-cross-site
 *      boundary, NOT a CSRF token check, and is never treated as one.
 *   2. Signed double-submit CSRF verification — the readable `sf_csrf` cookie
 *      must equal the `X-CSRF-Token` header (timing-safe), embed the CURRENT
 *      session id, and carry a valid HMAC (see CsrfService).
 *
 * Failures surface 403 (FORBIDDEN for origin, CSRF_VALIDATION_FAILED for the
 * token pair) — never 404, never identity detail. A missing authenticated
 * principal is a wiring error and fails closed (401).
 */
@Injectable()
export class CookieMutationGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly csrf: CsrfService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const principal = req.principal;
    if (!principal) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // 1) Browser origin/referer policy (delegates to the existing guard logic).
    new CookieOriginGuard(this.config).canActivate(context);

    // 2) Signed double-submit CSRF, bound to this session.
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const csrfCookieName = this.config.getOrThrow<{ csrfName: string }>(
      'auth.cookies',
    ).csrfName;
    const cookieValue = cookies?.[csrfCookieName];
    const headerValue = req.headers['x-csrf-token'] as string | undefined;

    if (!this.csrf.verify(principal.sessionId, cookieValue, headerValue)) {
      throw new HttpException(
        {
          code: ERROR_CODES.CSRF_VALIDATION_FAILED,
          message: 'CSRF validation failed.',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
