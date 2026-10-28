import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ERROR_CODES } from '../errors/error-codes';
import { RATE_LIMIT_KEY, RateLimitMeta } from './rate-limit.decorator';
import { RATE_LIMITER, RateLimiter } from './rate-limiter';

/**
 * Applies @RateLimit policy to annotated endpoints, keyed per client IP.
 * No-op for unannotated endpoints and when throttling is disabled by config
 * (automated-test default; production keeps it enabled).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: RateLimiter,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<RateLimitMeta>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;
    if (this.config.get<boolean>('auth.rateLimit.enabled') === false) return true;

    const request = context.switchToHttp().getRequest<{ ip?: string }>();
    const key = `${meta.bucket}:${request.ip ?? 'unknown'}`;

    const result = this.limiter.tryConsume(key, meta.limit, meta.windowSeconds);
    if (!result.allowed) {
      throw new HttpException(
        {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests — please try again later.',
          context: { retryAfterSeconds: result.retryAfterSeconds },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
