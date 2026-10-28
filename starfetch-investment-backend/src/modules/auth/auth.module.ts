import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { InMemoryRateLimiter } from '../../common/rate-limit/in-memory-rate-limiter';
import { RATE_LIMITER } from '../../common/rate-limit/rate-limiter';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EMAIL_PROVIDER } from './email/email-provider';
import { SmtpConfig, SmtpEmailProvider } from './email/smtp-email.provider';
import { AccessTokenGuard } from './guards/access-token.guard';
import { CookieOriginGuard } from './guards/cookie-origin.guard';
import { AccessTokenService } from './services/access-token.service';
import { CsrfService } from './services/csrf.service';
import { EmailVerificationService } from './services/email-verification.service';
import { PasswordService } from './services/password.service';
import { SessionService } from './services/session.service';

/**
 * Phase 2B authentication/identity module.
 * Email delivery is injected through the EMAIL_PROVIDER port (SMTP adapter by
 * default; FakeEmailProvider override in tests). The in-memory rate limiter is
 * replaceable behind the RATE_LIMITER port.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('auth.jwtAccessSecret'),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AccessTokenService,
    CsrfService,
    SessionService,
    EmailVerificationService,
    AccessTokenGuard,
    CookieOriginGuard,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SmtpEmailProvider({
          host: config.get<string>('smtp.host'),
          port: config.get<number>('smtp.port') ?? 1025,
          secure: config.get<boolean>('smtp.secure') ?? false,
          from: config.get<string>('smtp.from') ?? 'Starfetch <no-reply@starfetch.local>',
          user: config.get<string>('smtp.user'),
          pass: config.get<string>('smtp.pass'),
        } as SmtpConfig),
    },
    { provide: RATE_LIMITER, useClass: InMemoryRateLimiter },
    // Global, but a no-op on routes without @RateLimit metadata; disabled in
    // automated tests (config) so suites never flake on throttling.
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [AccessTokenService, AccessTokenGuard, AuthService],
})
export class AuthModule {}
