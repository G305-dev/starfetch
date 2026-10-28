import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CsrfService } from './csrf.service';

export interface SessionBundle {
  sessionId: string;
  userId: string;
  /** Raw opaque refresh credential (>=256-bit entropy). NEVER persisted or logged. */
  refreshToken: string;
  /** Readable signed CSRF cookie value bound to this session. */
  csrfToken: string;
  refreshMaxAgeSeconds: number;
}

const INVALID_SESSION_BODY = {
  code: ERROR_CODES.UNAUTHENTICATED,
  message: 'Session credential is invalid or expired. Please sign in again.',
} as const;

/**
 * Server-side session + opaque refresh-credential lifecycle.
 *
 * - AuthSession: absolute TTL (7 days) + sliding idle TTL (24 h), revocable.
 * - RefreshToken: 384-bit crypto-random raw credential; only SHA-256(raw)
 *   stored; single-use with rotation chaining (replacedByTokenId).
 * - Reuse detection: a presented credential that was already rotated, used or
 *   revoked → the ENTIRE session is revoked and the request is rejected.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly csrf: CsrfService,
  ) {}

  /** Login: create session + first refresh credential + CSRF token. */
  async establish(userId: string): Promise<SessionBundle> {
    const now = Date.now();
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        expiresAt: new Date(now + this.refreshTtlSeconds * 1000),
        idleExpiresAt: new Date(now + this.idleTtlSeconds * 1000),
      },
    });
    const refreshToken = await this.mintToken(session.id, now);
    return this.bundle(session, userId, refreshToken);
  }

  /** Refresh: validate → detect reuse → rotate → extend idle window. */
  async rotate(
    rawRefresh: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
  ): Promise<SessionBundle> {
    if (!rawRefresh) throw new HttpException(INVALID_SESSION_BODY, HttpStatus.UNAUTHORIZED);

    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawRefresh) },
      include: { session: true },
    });
    if (!token) throw new HttpException(INVALID_SESSION_BODY, HttpStatus.UNAUTHORIZED);

    const session = token.session;
    const now = Date.now();

    // REUSE DETECTION — an old/rotated/revoked credential was presented.
    // Kill the entire session; the legitimate owner's next refresh will fail,
    // forcing a fresh sign-in. Never silently accept reuse.
    if (token.usedAt || token.revokedAt || token.replacedByTokenId || session.revokedAt) {
      if (!session.revokedAt) {
        await this.revokeSession(session.id, 'REFRESH_REUSE_DETECTED');
        this.logger.warn(
          `Refresh-credential reuse detected — session ${session.id} revoked (user ${session.userId}).`,
        );
      }
      throw new HttpException(INVALID_SESSION_BODY, HttpStatus.UNAUTHORIZED);
    }

    if (token.expiresAt.getTime() <= now || session.expiresAt.getTime() <= now) {
      await this.revokeSession(session.id, 'SESSION_EXPIRED');
      throw new HttpException(INVALID_SESSION_BODY, HttpStatus.UNAUTHORIZED);
    }
    if (session.idleExpiresAt.getTime() <= now) {
      await this.revokeSession(session.id, 'IDLE_EXPIRED');
      throw new HttpException(INVALID_SESSION_BODY, HttpStatus.UNAUTHORIZED);
    }

    // Signed double-submit CSRF pair, bound to THIS session.
    if (!this.csrf.verify(session.id, csrfCookie, csrfHeader)) {
      throw new HttpException(
        {
          code: ERROR_CODES.CSRF_VALIDATION_FAILED,
          message: 'Security token mismatch — retry the request.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // ATOMIC SINGLE-USE CLAIM + rotation in one transaction.
    // The conditional UPDATE (usedAt/revokedAt still NULL) executes as a single
    // PostgreSQL statement: if two requests present the same credential
    // concurrently, exactly ONE updateMany matches — the loser gets count 0 and
    // is treated as REUSE (entire session revoked). This replaces the raceable
    // read-check-later-update pattern.
    const replacementRaw = this.generateRaw();
    const claimed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.refreshToken.updateMany({
        where: { id: token.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date(now) },
      });
      if (claim.count !== 1) return false;
      const created = await tx.refreshToken.create({
        data: {
          sessionId: session.id,
          tokenHash: this.hash(replacementRaw),
          expiresAt: new Date(now + this.refreshTtlSeconds * 1000),
        },
      });
      await tx.refreshToken.update({
        where: { id: token.id },
        data: { replacedByTokenId: created.id },
      });
      await tx.authSession.update({
        where: { id: session.id },
        data: {
          lastUsedAt: new Date(now),
          idleExpiresAt: new Date(now + this.idleTtlSeconds * 1000),
        },
      });
      return true;
    });

    if (!claimed) {
      // A concurrent claimant consumed the credential first → reuse detection.
      await this.revokeSession(session.id, 'REFRESH_REUSE_DETECTED');
      this.logger.warn(
        `Concurrent refresh-credential reuse detected — session ${session.id} revoked (user ${session.userId}).`,
      );
      throw new HttpException(INVALID_SESSION_BODY, HttpStatus.UNAUTHORIZED);
    }

    return this.bundle(session, session.userId, replacementRaw);
  }

  /** Logout: revoke session + current credential. Missing/known-stale input is
   *  idempotent-safe (controller always clears cookies regardless). */
  async terminate(
    rawRefresh: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
  ): Promise<void> {
    if (!rawRefresh) return;

    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawRefresh) },
      include: { session: true },
    });
    if (!token || token.session.revokedAt) return; // idempotent
    if (token.usedAt || token.revokedAt) return; // already rotated away — nothing to act on

    if (!this.csrf.verify(token.sessionId, csrfCookie, csrfHeader)) {
      throw new HttpException(
        {
          code: ERROR_CODES.CSRF_VALIDATION_FAILED,
          message: 'Security token mismatch — retry the request.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    await this.revokeSession(token.sessionId, 'USER_LOGOUT');
    this.logger.log(`Session ${token.sessionId} revoked by logout (user ${token.session.userId}).`);
  }

  private async revokeSession(sessionId: string, reason: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.update({
        where: { id: sessionId },
        data: { revokedAt: now, revokeReason: reason },
      }),
      this.prisma.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  private async mintToken(sessionId: string, nowMs: number): Promise<string> {
    const raw = this.generateRaw();
    await this.prisma.refreshToken.create({
      data: {
        sessionId,
        tokenHash: this.hash(raw),
        expiresAt: new Date(nowMs + this.refreshTtlSeconds * 1000),
      },
    });
    return raw;
  }

  private bundle(
    session: { id: string },
    userId: string,
    refreshToken: string,
  ): SessionBundle {
    return {
      sessionId: session.id,
      userId,
      refreshToken,
      csrfToken: this.csrf.issue(session.id),
      refreshMaxAgeSeconds: this.refreshTtlSeconds,
    };
  }

  /** 384 bits of entropy — exceeds the required 256-bit minimum. */
  private generateRaw(): string {
    return randomBytes(48).toString('base64url');
  }

  /** One-way fixed verifier for the high-entropy credential. */
  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private get refreshTtlSeconds(): number {
    return this.config.get<number>('auth.refreshTokenTtlSeconds') ?? 604_800;
  }
  private get idleTtlSeconds(): number {
    return this.config.get<number>('auth.refreshIdleTtlSeconds') ?? 86_400;
  }
}
