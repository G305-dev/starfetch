import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthenticatedRequest } from '../../../common/types/auth-principal';
import { KEYED_RATE_LIMIT_KEY, KeyedRateLimitMeta } from '../../../common/rate-limit/keyed-rate-limit.decorator';
import { CORPORATE_O2_RATE_LIMITER, CorporateO2RateLimiter } from '../rate-limit/corporate-o2-rate-limiter';

@Injectable()
export class CorporateO2RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CORPORATE_O2_RATE_LIMITER) private readonly limiter: CorporateO2RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<KeyedRateLimitMeta>(
      KEYED_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta || meta.bucket !== 'corporate-o2-create' || meta.identity !== 'user' ||
        meta.limit !== 5 || meta.windowSeconds !== 3600) {
      throw new HttpException(
        { code: ERROR_CODES.INTERNAL_ERROR, message: 'Rate-limit policy unavailable.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.principal?.userId) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Corporate O2 rate limiting is mandatory regardless of the general
    // process-local limiter's test/development switch. Store errors never bypass it.
    let result;
    try {
      result = await this.limiter.consumeUser(request.principal.userId, meta.limit, meta.windowSeconds);
    } catch {
      throw new HttpException(
        { code: ERROR_CODES.SERVICE_UNAVAILABLE, message: 'Corporate registration is temporarily unavailable.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterSeconds ?? 1));
      context.switchToHttp().getResponse<Response>().setHeader('Retry-After', String(retryAfterSeconds));
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests — please try again later.',
          context: { retryAfterSeconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
