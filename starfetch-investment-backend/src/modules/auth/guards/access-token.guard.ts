import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthenticatedRequest } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AccessTokenService } from '../services/access-token.service';

const UNAUTH = (message: string) =>
  new HttpException({ code: ERROR_CODES.UNAUTHENTICATED, message }, HttpStatus.UNAUTHORIZED);

/**
 * Reusable bearer-token guard. Two layers:
 *  1. cryptographic JWT validation (signature, expiry, minimal claims);
 *  2. SESSION-AWARE check — the `sid` claim must reference an AuthSession that
 *     exists, belongs to `sub`, and is neither revoked nor past absolute/idle
 *     expiry. Logout and refresh-credential reuse detection therefore
 *     terminate protected access immediately, without waiting for the
 *     access JWT's 15-minute expiry.
 *
 * All failures surface the same safe 401 — no session details leak.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly accessTokens: AccessTokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      throw UNAUTH('Authentication required.');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) throw UNAUTH('Authentication required.');

    let principal;
    try {
      principal = await this.accessTokens.verify(token);
    } catch {
      throw UNAUTH('Access token is invalid or expired.');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: principal.sessionId },
      select: { userId: true, expiresAt: true, idleExpiresAt: true, revokedAt: true },
    });
    const now = Date.now();
    if (
      !session ||
      session.userId !== principal.userId ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now ||
      session.idleExpiresAt.getTime() <= now
    ) {
      throw UNAUTH('Authentication required.');
    }

    request.principal = principal;
    return true;
  }
}
