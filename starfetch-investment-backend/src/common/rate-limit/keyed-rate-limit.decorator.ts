import { SetMetadata } from '@nestjs/common';

export const KEYED_RATE_LIMIT_KEY = 'joint:keyed-rate-limit';

export type KeyedRateLimitIdentity = 'user' | 'user+account';

export interface KeyedRateLimitMeta {
  bucket: string;
  limit: number;
  windowSeconds: number;
  identity: KeyedRateLimitIdentity;
}

/**
 * Post-authentication rate limit (Phase 3B). Attach to endpoints that ALSO use
 * @UseGuards(AccessTokenGuard, RolesGuard[, JointMembershipGuard], KeyedRateLimitGuard)
 * — in that order. The keyed guard derives identity exclusively from the
 * validated principal/membership context assembled by those earlier guards.
 *
 * Development thresholds pending business approval (documented, in-memory,
 * process-local): account creation 5/h/user; invitation creation 5/h/user+account;
 * invitation accept/decline 20/h/user.
 */
export const KeyedRateLimit = (meta: KeyedRateLimitMeta) =>
  SetMetadata(KEYED_RATE_LIMIT_KEY, meta);
