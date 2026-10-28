import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CookieOriginGuard } from './guards/cookie-origin.guard';
import { SessionBundle } from './services/session.service';

/**
 * Phase 2B authentication endpoints (scope-limited; no other business APIs).
 *
 * Transport duties — and ONLY transport duties — live here: the refresh
 * credential is set as an HttpOnly cookie (never in JSON), and the CSRF token
 * as a readable cookie. Core services stay client-neutral so the future React
 * Native app can reuse them with platform-secure storage instead of cookies.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @RateLimit({ bucket: 'auth-register', limit: 5, windowSeconds: 600 })
  async register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'auth-verify', limit: 10, windowSeconds: 600 })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.verificationId, dto.code);
  }

  @Post('email/resend')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'auth-resend', limit: 6, windowSeconds: 3600 })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.verificationId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'auth-login', limit: 10, windowSeconds: 600 })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    this.setSessionCookies(res, result.session);
    return result.data;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieOriginGuard)
  @RateLimit({ bucket: 'auth-refresh', limit: 60, windowSeconds: 600 })
  async refresh(
    @Req() req: Request,
    @Headers('x-csrf-token') csrfHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.refresh(
      this.refreshCookie(req),
      this.csrfCookie(req),
      csrfHeader,
    );
    // Rotate: replace HttpOnly refresh cookie + readable CSRF cookie.
    this.setSessionCookies(res, result.session);
    return result.data;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CookieOriginGuard)
  @RateLimit({ bucket: 'auth-logout', limit: 60, windowSeconds: 600 })
  async logout(
    @Req() req: Request,
    @Headers('x-csrf-token') csrfHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(this.refreshCookie(req), this.csrfCookie(req), csrfHeader);
    // Safe/idempotent: cookies are always cleared.
    this.clearSessionCookies(res);
    return { data: { loggedOut: true } };
  }

  // ── Cookie helpers (transport layer only) ──────────────────────────────────

  private get cookieConfig(): { refreshName: string; csrfName: string; secure: boolean } {
    return this.config.getOrThrow('auth.cookies');
  }

  private setSessionCookies(res: Response, session: SessionBundle): void {
    const { refreshName, csrfName, secure } = this.cookieConfig;
    const maxAge = session.refreshMaxAgeSeconds * 1000;
    // Refresh credential: HttpOnly — never readable by JavaScript.
    res.cookie(refreshName, session.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
    // CSRF token: readable double-submit cookie.
    res.cookie(csrfName, session.csrfToken, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge,
    });
  }

  private clearSessionCookies(res: Response): void {
    const { refreshName, csrfName, secure } = this.cookieConfig;
    res.clearCookie(refreshName, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
    res.clearCookie(csrfName, { httpOnly: false, secure, sameSite: 'lax', path: '/' });
  }

  private refreshCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string | undefined> | undefined)?.[this.cookieConfig.refreshName];
  }

  private csrfCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string | undefined> | undefined)?.[this.cookieConfig.csrfName];
  }
}
