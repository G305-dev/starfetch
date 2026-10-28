import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'auth:rate-limit';

export interface RateLimitMeta {
  bucket: string;
  limit: number;
  windowSeconds: number;
}

/** Marks an endpoint for server-side throttling (see RateLimitGuard). */
export const RateLimit = (meta: RateLimitMeta) => SetMetadata(RATE_LIMIT_KEY, meta);
