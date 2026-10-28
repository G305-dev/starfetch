import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, randomInt, randomUUID } from 'crypto';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { maskEmail } from '../../../common/utils/email-mask';
import { secureCompare } from '../../../common/utils/secure-compare';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EMAIL_PROVIDER, EmailProvider } from '../email/email-provider';

export interface IssuedChallenge {
  challengeId: string;
  /** Raw 6-digit code — exists only in memory/e-mail, never logged or stored. */
  code: string;
  expiresAt: Date;
}

function consumedError(): HttpException {
  return new HttpException(
    {
      code: ERROR_CODES.EMAIL_VERIFICATION_CONSUMED,
      message: 'This verification code has already been used.',
    },
    HttpStatus.CONFLICT,
  );
}

function attemptsExceeded(): HttpException {
  return new HttpException(
    {
      code: ERROR_CODES.EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED,
      message: 'Too many incorrect attempts — request a new verification code.',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

function expiredError(): HttpException {
  return new HttpException(
    {
      code: ERROR_CODES.EMAIL_VERIFICATION_EXPIRED,
      message: 'This verification code has expired — request a new one.',
    },
    HttpStatus.BAD_REQUEST,
  );
}

function invalidError(): HttpException {
  return new HttpException(
    { code: ERROR_CODES.EMAIL_VERIFICATION_INVALID, message: 'Verification code is invalid.' },
    HttpStatus.BAD_REQUEST,
  );
}

/**
 * Email-ownership challenge service.
 *
 * Contract: 6 numeric digits from a CSPRNG; 10-minute lifetime; max 5
 * attempts; 60 s resend cooldown; max 5 resends/hour; resend rotates code +
 * verifier + expiry (invalidating the previous code); successful verification
 * consumes the code (single-use) and sets users.emailVerifiedAt atomically.
 * Storage is a keyed HMAC-SHA-256 bound to (challengeId, code); the raw code
 * and the HMAC are never logged.
 */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  /** Creates the challenge INSIDE an existing transaction (registration). */
  async createChallenge(tx: Prisma.TransactionClient, userId: string): Promise<IssuedChallenge> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challengeId = randomUUID();
    const expiresAt = new Date(Date.now() + this.codeTtlSeconds * 1000);
    await tx.emailVerificationChallenge.create({
      data: {
        id: challengeId,
        userId,
        codeHmac: this.hmac(challengeId, code),
        expiresAt,
        lastSentAt: new Date(),
      },
    });
    return { challengeId, code, expiresAt };
  }

  /** Delivers an issued code through the email-provider port. */
  async sendCode(to: string, issued: IssuedChallenge): Promise<void> {
    try {
      await this.emailProvider.sendEmailVerificationCode({
        to,
        code: issued.code,
        expiresInMinutes: Math.round(this.codeTtlSeconds / 60),
      });
      this.logger.log(`Verification code issued to ${maskEmail(to)} (challenge ${issued.challengeId}).`);
    } catch (error) {
      this.logger.error(
        `Verification email delivery failed for ${maskEmail(to)}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new HttpException(
        {
          code: ERROR_CODES.EMAIL_DELIVERY_FAILED,
          message: 'We could not send the verification email — please try again.',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Latest unconsumed challenge id for a user (login EMAIL_NOT_VERIFIED hint). */
  async latestChallengeIdFor(userId: string): Promise<string | undefined> {
    const latest = await this.prisma.emailVerificationChallenge.findFirst({
      where: { userId, consumedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return latest?.id;
  }

  async verify(verificationId: string, code: string): Promise<{ emailVerified: true }> {
    const challenge = await this.prisma.emailVerificationChallenge.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });
    if (!challenge) {
      throw new HttpException(
        {
          code: ERROR_CODES.EMAIL_VERIFICATION_INVALID,
          message: 'Verification request not found or expired.',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    let latest = challenge;
    const readCurrent = async () => {
      latest = (await this.prisma.emailVerificationChallenge.findUnique({
        where: { id: challenge.id },
        include: { user: true },
      }))!;
      return latest;
    };

    const now = new Date();
    if (latest.consumedAt) throw consumedError();
    if (latest.revokedAt || latest.attemptCount >= this.maxAttempts) throw attemptsExceeded();
    if (latest.expiresAt.getTime() <= now.getTime()) throw expiredError();

    if (!secureCompare(this.hmac(challenge.id, code), challenge.codeHmac)) {
      // ATOMIC increment — single conditional UPDATE, no lost increments, and
      // the cap can never be exceeded even under concurrency. The increment is
      // also bound to the code GENERATION read above (`codeHmac`): if a resend
      // rotated the code while this request was in flight, this update matches
      // nothing and the NEW generation's attempt counter is left untouched.
      const bumped = await this.prisma.emailVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          revokedAt: null,
          attemptCount: { lt: this.maxAttempts },
          codeHmac: challenge.codeHmac,
        },
        data: { attemptCount: { increment: 1 } },
      });
      if (bumped.count !== 1) {
        // Lost the conditional race: consumed by a concurrent success, capped
        // concurrently, or the code generation rotated beneath us. Re-read the
        // CURRENT state and return the appropriate safe response — without
        // mutating the new generation's attempts and without revealing rotation.
        await readCurrent();
        if (latest.consumedAt) throw consumedError();
        if (latest.revokedAt || latest.attemptCount >= this.maxAttempts) throw attemptsExceeded();
        if (latest.expiresAt.getTime() <= now.getTime()) throw expiredError();
        throw invalidError();
      }
      await readCurrent();
      if (latest.attemptCount >= this.maxAttempts) {
        await this.prisma.emailVerificationChallenge.updateMany({
          where: { id: challenge.id, revokedAt: null },
          data: { revokedAt: now },
        });
        throw attemptsExceeded();
      }
      throw invalidError();
    }

    // Correct code → ATOMIC single-use consume + user verification in ONE tx.
    // The conditional consume (codeHmac generation match, unconsumed, unrevoked,
    // unexpired, AND still below the attempt cap) guarantees exactly one winner
    // under concurrent requests AND enforces: once the fifth incorrect attempt
    // commits (attemptCount reaches max), a correct-code request can NEVER
    // subsequently consume — even if it raced before revokedAt was set.
    const claimed = await this.prisma.$transaction(async (tx) => {
      const consume = await tx.emailVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
          attemptCount: { lt: this.maxAttempts },
          codeHmac: challenge.codeHmac,
        },
        data: { consumedAt: now },
      });
      if (consume.count !== 1) return false;
      await tx.user.update({ where: { id: challenge.userId }, data: { emailVerifiedAt: now } });
      return true;
    });

    if (!claimed) {
      await readCurrent();
      if (latest.consumedAt) throw consumedError(); // second winner loses safely
      if (latest.revokedAt || latest.attemptCount >= this.maxAttempts) throw attemptsExceeded();
      if (latest.expiresAt.getTime() <= now.getTime()) throw expiredError();
      throw new HttpException(
        { code: ERROR_CODES.EMAIL_VERIFICATION_INVALID, message: 'Verification code is invalid.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return { emailVerified: true };
  }

  async resend(verificationId: string): Promise<{
    verificationId: string;
    email: string;
    expiresInSeconds: number;
    resendInSeconds: number;
  }> {
    const challenge = await this.prisma.emailVerificationChallenge.findUnique({
      where: { id: verificationId },
      include: { user: true },
    });
    if (!challenge) {
      throw new HttpException(
        {
          code: ERROR_CODES.EMAIL_VERIFICATION_INVALID,
          message: 'Verification request not found or expired.',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    if (challenge.user.emailVerifiedAt) {
      throw new HttpException(
        { code: ERROR_CODES.CONFLICT, message: 'This email address is already verified.' },
        HttpStatus.CONFLICT,
      );
    }

    const now = Date.now();
    const cooldownRemaining = Math.ceil(
      (challenge.lastSentAt.getTime() + this.resendCooldownSeconds * 1000 - now) / 1000,
    );
    if (cooldownRemaining > 0) {
      throw new HttpException(
        {
          code: ERROR_CODES.RESEND_COOLDOWN,
          message: 'Please wait before requesting another code.',
          context: { retryAfterSeconds: cooldownRemaining },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Rolling 1-hour resend window (values read pre-claim; the claim below
    // serializes concurrent resenders, so counters can't race).
    let resendCount = challenge.resendCount;
    let resendWindowStartedAt = challenge.resendWindowStartedAt;
    if (resendWindowStartedAt.getTime() + this.resendWindowSeconds * 1000 <= now) {
      resendCount = 0;
      resendWindowStartedAt = new Date(now);
    }
    if (resendCount >= this.maxResendsPerHour) {
      const windowSecondsRemaining = Math.ceil(
        (resendWindowStartedAt.getTime() + this.resendWindowSeconds * 1000 - now) / 1000,
      );
      throw new HttpException(
        {
          code: ERROR_CODES.RESEND_LIMIT_EXCEEDED,
          message: 'Verification code resend limit reached — try again later.',
          context: { retryAfterSeconds: Math.max(1, windowSecondsRemaining) },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Rotation keeps the same verificationId while invalidating the old code.
    // The ATOMIC conditional claim (cooldown satisfied, not consumed, email not
    // yet verified) guarantees exactly one resender proceeds under concurrency —
    // two parallel requests can never both bypass the cooldown or leave two
    // simultaneously valid codes.
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(now + this.codeTtlSeconds * 1000);
    const claimed = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.emailVerificationChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
          user: { emailVerifiedAt: null },
          lastSentAt: { lte: new Date(now - this.resendCooldownSeconds * 1000) },
        },
        data: { lastSentAt: new Date(now) },
      });
      if (claim.count !== 1) return false;
      await tx.emailVerificationChallenge.update({
        where: { id: challenge.id },
        data: {
          codeHmac: this.hmac(challenge.id, code),
          expiresAt,
          attemptCount: 0,
          revokedAt: null,
          consumedAt: null,
          resendCount: resendCount + 1,
          resendWindowStartedAt,
        },
      });
      return true;
    });

    if (!claimed) {
      throw new HttpException(
        {
          code: ERROR_CODES.RESEND_COOLDOWN,
          message: 'Please wait before requesting another code.',
          context: { retryAfterSeconds: this.resendCooldownSeconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.sendCode(challenge.user.email, { challengeId: challenge.id, code, expiresAt });

    return {
      verificationId: challenge.id,
      email: maskEmail(challenge.user.email),
      expiresInSeconds: this.codeTtlSeconds,
      resendInSeconds: this.resendCooldownSeconds,
    };
  }

  private hmac(challengeId: string, code: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('auth.emailVerificationHmacSecret'))
      .update(`${challengeId}.${code}`)
      .digest('hex');
  }
  private get codeTtlSeconds(): number {
    return this.config.get<number>('auth.verificationCodeTtlSeconds') ?? 600;
  }
  private get maxAttempts(): number {
    return this.config.get<number>('auth.verificationMaxAttempts') ?? 5;
  }
  private get resendCooldownSeconds(): number {
    return this.config.get<number>('auth.verificationResendCooldownSeconds') ?? 60;
  }
  private get maxResendsPerHour(): number {
    return this.config.get<number>('auth.verificationMaxResendsPerHour') ?? 5;
  }
  private get resendWindowSeconds(): number {
    return this.config.get<number>('auth.verificationResendWindowSeconds') ?? 3600;
  }
}
