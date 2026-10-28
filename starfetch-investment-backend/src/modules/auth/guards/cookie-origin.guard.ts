import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ERROR_CODES } from '../../../common/errors/error-codes';

/**
 * Origin/Referer policy for cookie-authenticated, state-changing requests.
 * We do not rely on SameSite alone: when a browser Origin (or Referer) header
 * is present, it must match the configured CORS allowlist. Requests without
 * either header (non-browser clients) pass — the signed double-submit CSRF
 * pair is still enforced separately.
 */
@Injectable()
export class CookieOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const allowlist = this.config.get<string[]>('cors.origins') ?? [];

    let origin = request.headers.origin;
    if (!origin && request.headers.referer) {
      try {
        origin = new URL(request.headers.referer).origin;
      } catch {
        origin = undefined;
      }
    }
    if (!origin) return true; // non-browser client

    if (allowlist.includes(origin)) return true;

    throw new HttpException(
      { code: ERROR_CODES.FORBIDDEN, message: 'Untrusted request origin.' },
      HttpStatus.FORBIDDEN,
    );
  }
}
