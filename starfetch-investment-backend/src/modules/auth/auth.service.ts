import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvestorProfile, Prisma, User, UserRole } from '@prisma/client';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { maskEmail, normalizeEmail } from '../../common/utils/email-mask';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenService } from './services/access-token.service';
import { EmailVerificationService, IssuedChallenge } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { SessionBundle, SessionService } from './services/session.service';

export interface SafeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
}

export interface RegisterResult {
  data: {
    userId: string;
    verificationId: string;
    email: string;
    emailVerified: false;
    nextAction: 'VERIFY_EMAIL';
  };
}

export interface LoginResult {
  data: {
    accessToken: string;
    expiresInSeconds: number;
    user: SafeUser;
  };
  session: SessionBundle;
}

export interface RefreshResult {
  data: {
    accessToken: string;
    expiresInSeconds: number;
  };
  session: SessionBundle;
}

/**
 * Authentication/identity orchestration. Client-neutral: services know
 * nothing about cookies — the HTTP controller layer alone decides where the
 * refresh credential and CSRF token travel (browser cookies now; platform
 * secure storage for the future mobile app).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly verification: EmailVerificationService,
    private readonly sessions: SessionService,
    private readonly accessTokens: AccessTokenService,
  ) {}

  /**
   * Investor registration — atomic User + InvestorProfile + verification
   * challenge creation. NEVER issues a session or credentials, NEVER marks
   * the email verified. Public registration hard-codes role=INVESTOR; there is
   * no public STAFF/ADMIN self-registration surface.
   */
  async register(dto: RegisterDto): Promise<RegisterResult> {
    const email = dto.email.trim();
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await this.passwords.hash(dto.password);

    let outcome: { user: User; challenge: IssuedChallenge };
    try {
      outcome = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, normalizedEmail, passwordHash, role: UserRole.INVESTOR },
        });
        await tx.investorProfile.create({
          data: { userId: user.id, firstName: dto.firstName.trim(), lastName: dto.lastName.trim() },
        });
        const challenge = await this.verification.createChallenge(tx, user.id);
        return { user, challenge };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Same public outcome regardless of the existing account's state.
        throw new HttpException(
          { code: ERROR_CODES.CONFLICT, message: 'An account with this email address already exists.' },
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }

    // Post-commit delivery: account persists even if mail transport fails
    // (the client can use the resend endpoint).
    await this.verification.sendCode(outcome.user.email, outcome.challenge);
    this.logger.log(`Registered investor ${outcome.user.id} (${maskEmail(email)}).`);

    return {
      data: {
        userId: outcome.user.id,
        verificationId: outcome.challenge.challengeId,
        email: maskEmail(email),
        emailVerified: false,
        nextAction: 'VERIFY_EMAIL',
      },
    };
  }

  async verifyEmail(verificationId: string, code: string) {
    const result = await this.verification.verify(verificationId, code);
    return { data: { ...result, nextAction: 'LOGIN' as const } };
  }

  async resendVerification(verificationId: string) {
    const result = await this.verification.resend(verificationId);
    return { data: result };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const normalizedEmail = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { normalizedEmail },
      include: { investorProfile: true },
    });

    // Identical public outcome for unknown email vs wrong password, with
    // equalized Argon2 verification time (no user-existence oracle).
    const passwordOk = await this.passwords.verifyOrEqualize(user?.passwordHash, dto.password);
    if (!user || !passwordOk) {
      throw new HttpException(
        { code: ERROR_CODES.INVALID_CREDENTIALS, message: 'We could not sign you in with those details.' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.emailVerifiedAt) {
      const verificationId = await this.verification.latestChallengeIdFor(user.id);
      throw new HttpException(
        {
          code: ERROR_CODES.EMAIL_NOT_VERIFIED,
          message: 'Please verify your email address before signing in.',
          context: {
            ...(verificationId ? { verificationId } : {}),
            email: maskEmail(user.email),
          },
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const session = await this.sessions.establish(user.id);
    const accessToken = await this.accessTokens.sign({
      userId: user.id,
      role: user.role,
      sessionId: session.sessionId,
    });
    this.logger.log(`Login succeeded for ${maskEmail(user.email)} (session ${session.sessionId}).`);

    return {
      data: {
        accessToken,
        expiresInSeconds: this.accessTokens.ttlSeconds,
        user: this.safeUser(user),
      },
      session,
    };
  }

  async refresh(
    rawRefresh: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
  ): Promise<RefreshResult> {
    const session = await this.sessions.rotate(rawRefresh, csrfCookie, csrfHeader);
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      throw new HttpException(INVALID_SESSION, HttpStatus.UNAUTHORIZED);
    }
    const accessToken = await this.accessTokens.sign({
      userId: user.id,
      role: user.role,
      sessionId: session.sessionId,
    });
    return {
      data: { accessToken, expiresInSeconds: this.accessTokens.ttlSeconds },
      session,
    };
  }

  async logout(
    rawRefresh: string | undefined,
    csrfCookie: string | undefined,
    csrfHeader: string | undefined,
  ): Promise<void> {
    await this.sessions.terminate(rawRefresh, csrfCookie, csrfHeader);
  }

  /** Safe profile projection — never leaks hashes/normalized email/secrets. */
  safeUser(user: User & { investorProfile?: InvestorProfile | null }): SafeUser {
    return {
      id: user.id,
      firstName: user.investorProfile?.firstName ?? '',
      lastName: user.investorProfile?.lastName ?? '',
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      role: user.role,
    };
  }
}

const INVALID_SESSION = {
  code: ERROR_CODES.UNAUTHENTICATED,
  message: 'Session credential is invalid or expired. Please sign in again.',
} as const;
