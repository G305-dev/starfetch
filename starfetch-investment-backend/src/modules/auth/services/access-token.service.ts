import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ROLES: readonly string[] = [UserRole.INVESTOR, UserRole.STAFF, UserRole.ADMIN];

interface AccessClaims {
  sub?: unknown;
  role?: unknown;
  sid?: unknown;
}

/**
 * Short-lived JWT access credential (15 min, HS256, secret from environment).
 * Claims stay minimal — sub / role / sid only. Never carries KYC, phone,
 * financial, portfolio or document data.
 */
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  get ttlSeconds(): number {
    return this.config.get<number>('auth.accessTokenTtlSeconds') ?? 900;
  }

  sign(principal: AuthPrincipal): Promise<string> {
    return this.jwt.signAsync(
      { sub: principal.userId, role: principal.role, sid: principal.sessionId },
      { expiresIn: this.ttlSeconds },
    );
  }

  /**
   * Verifies signature + expiry (JwtModule is pinned to HS256) and strictly
   * validates the minimal claims shape. Throws on any failure — callers
   * convert that into a single safe 401.
   */
  async verify(token: string): Promise<AuthPrincipal> {
    const claims = await this.jwt.verifyAsync<AccessClaims>(token);

    if (
      typeof claims.sub !== 'string' ||
      !UUID_PATTERN.test(claims.sub) ||
      typeof claims.sid !== 'string' ||
      !UUID_PATTERN.test(claims.sid) ||
      typeof claims.role !== 'string' ||
      !VALID_ROLES.includes(claims.role)
    ) {
      throw new Error('Malformed access-token claims.');
    }

    return { userId: claims.sub, role: claims.role as UserRole, sessionId: claims.sid };
  }
}
