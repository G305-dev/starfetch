import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { Redis } from '@upstash/redis';
import {
  CORPORATE_O2_FIXED_WINDOW_LUA,
  UpstashCorporateO2RateLimiter,
} from './corporate-o2-rate-limiter';

describe('UpstashCorporateO2RateLimiter', () => {
  const secret = Buffer.alloc(32, 0x62).toString('base64');
  const userId = 'a-synthetic-user-id';
  const redis = { eval: jest.fn() } as unknown as Redis;
  const config = { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
  let limiter: UpstashCorporateO2RateLimiter;

  beforeEach(() => {
    jest.clearAllMocks();
    (config.get as jest.Mock).mockReturnValue(secret);
    limiter = new UpstashCorporateO2RateLimiter(config, redis);
  });

  it('uses one atomic fixed-window script and an HMAC-derived user key', async () => {
    (redis.eval as jest.Mock).mockResolvedValue([1, 3_600_000]);
    await expect(limiter.consumeUser(userId, 5, 3600)).resolves.toEqual({ allowed: true });

    const expectedDigest = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update('starfetch:corporate-o2:rate-limit:v1\0')
      .update(userId, 'utf8')
      .digest('hex');
    expect(redis.eval).toHaveBeenCalledWith(
      CORPORATE_O2_FIXED_WINDOW_LUA,
      [`sf:corporate:o2:rate:v1:${expectedDigest}`],
      [3_600_000, 5],
    );
    expect(JSON.stringify((redis.eval as jest.Mock).mock.calls)).not.toContain(userId);
  });

  it('returns retry-after rounded up from the atomic bucket TTL', async () => {
    (redis.eval as jest.Mock).mockResolvedValue(['0', '1001']);
    await expect(limiter.consumeUser(userId, 5, 3600)).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 2,
    });
  });

  it.each([
    ['Redis timeout', () => (redis.eval as jest.Mock).mockRejectedValue(new Error('synthetic timeout'))],
    ['malformed Redis response', () => (redis.eval as jest.Mock).mockResolvedValue([2, 1000])],
    ['missing Redis client', () => { limiter = new UpstashCorporateO2RateLimiter(config, undefined); }],
    ['invalid HMAC key', () => (config.get as jest.Mock).mockReturnValue('not-base64')],
  ])('fails closed on %s', async (_label, configure) => {
    configure();
    await expect(limiter.consumeUser(userId, 5, 3600)).rejects.toMatchObject({
      status: 503,
      response: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Corporate registration is temporarily unavailable.',
      },
    });
  });

  it('rejects invalid limits without calling Redis', async () => {
    await expect(limiter.consumeUser(userId, 0, 3600)).rejects.toMatchObject({ status: 503 });
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
