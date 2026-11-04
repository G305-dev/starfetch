import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthenticatedRequest } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/** Route-param name every joint account-scoped route must use. */
export const JOINT_ACCOUNT_PARAM = 'jointAccountId';

/** Request extension populated by {@link JointMembershipGuard}. */
export interface JointAccountContext {
  jointAccountId: string;
  memberUserId: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND_BODY = { code: ERROR_CODES.NOT_FOUND, message: 'Account not found.' };

function notFound(): never {
  throw new HttpException(NOT_FOUND_BODY, HttpStatus.NOT_FOUND);
}

/**
 * Joint account membership authorization (Phase 3B Step 2).
 *
 * MUST run AFTER `AccessTokenGuard` (and `RolesGuard` for INVESTOR). It reads
 * the account identifier from the path parameter ONLY — never from body/query —
 * and verifies, against PostgreSQL on EVERY request, that:
 *   1. the identifier is a well-formed UUID (malformed → same 404);
 *   2. the joint account exists;
 *   3. the caller holds an ACTIVE membership row for it.
 *
 * Anti-enumeration: unknown accounts, inaccessible accounts, malformed IDs and
 * pending/not-yet-accepted invitees all receive the IDENTICAL 404 — account
 * existence is never disclosed through message, code or shape differences.
 * Creating an account or sending an invitation grants nothing by itself;
 * authorization derives exclusively from membership rows.
 */
@Injectable()
export class JointMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest & {
      jointContext?: JointAccountContext;
    }>();

    const principal = req.principal;
    if (!principal) {
      // Misconfiguration — this guard requires a prior AccessTokenGuard.
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const rawId = req.params?.[JOINT_ACCOUNT_PARAM];
    if (typeof rawId !== 'string' || !UUID_PATTERN.test(rawId)) notFound();

    // Explicit two-step proof: account existence AND caller membership, both
    // queried server-side on every request. A pending invitation row grants
    // nothing — only a membership row does.
    const account = await this.prisma.jointAccount.findUnique({ where: { id: rawId } });
    if (!account) notFound();
    const membership = await this.prisma.jointAccountMember.findUnique({
      where: {
        jointAccountId_userId: { jointAccountId: rawId, userId: principal.userId },
      },
    });
    if (!membership) notFound();

    req.jointContext = {
      jointAccountId: account.id,
      memberUserId: membership.userId,
    };
    return true;
  }
}
