import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../../common/types/auth-principal';
import { CorporateO2RateLimiter } from '../rate-limit/corporate-o2-rate-limiter';
import { CorporateO2RateLimitGuard } from './corporate-o2-rate-limit.guard';

function executionContext(request: Partial<AuthenticatedRequest>, response = { setHeader: jest.fn() }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as any;
}

describe('CorporateO2RateLimitGuard', () => {
  const metadata = {
    bucket: 'corporate-o2-create', limit: 5, windowSeconds: 3600, identity: 'user',
  };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(metadata) } as unknown as Reflector;
  const limiter = { consumeUser: jest.fn() } as jest.Mocked<CorporateO2RateLimiter>;
  let guard: CorporateO2RateLimitGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(metadata);
    limiter.consumeUser.mockResolvedValue({ allowed: true });
    guard = new CorporateO2RateLimitGuard(reflector, limiter,);
  });

  it('charges the authenticated principal against exactly 5 requests per 3600 seconds', async () => {
    await expect(guard.canActivate(executionContext({ principal: {
      userId: 'authenticated-synthetic-user', role: 'INVESTOR' as any, sessionId: 'session',
    } }))).resolves.toBe(true);
    expect(limiter.consumeUser).toHaveBeenCalledWith('authenticated-synthetic-user', 5, 3600);
  });

  it('requires authentication before consulting the shared limiter', async () => {
    await expect(guard.canActivate(executionContext({}))).rejects.toMatchObject({ status: 401 });
    expect(limiter.consumeUser).not.toHaveBeenCalled();
  });

  it('sets Retry-After and rejects a request over quota', async () => {
    limiter.consumeUser.mockResolvedValue({ allowed: false, retryAfterSeconds: 47 });
    const response = { setHeader: jest.fn() };
    await expect(guard.canActivate(executionContext({ principal: {
      userId: 'authenticated-synthetic-user', role: 'INVESTOR' as any, sessionId: 'session',
    } }, response))).rejects.toMatchObject({ status: 429 });
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '47');
  });

  it('fails closed with 503 if Redis is unavailable', async () => {
    limiter.consumeUser.mockRejectedValue(new Error('synthetic outage'));
    await expect(guard.canActivate(executionContext({ principal: {
      userId: 'authenticated-synthetic-user', role: 'INVESTOR' as any, sessionId: 'session',
    } }))).rejects.toMatchObject({ status: 503 });
  });

  it('fails closed if the controller policy is missing or changed', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({ ...metadata, limit: 6 });
    await expect(guard.canActivate(executionContext({ principal: {
      userId: 'authenticated-synthetic-user', role: 'INVESTOR' as any, sessionId: 'session',
    } }))).rejects.toMatchObject({ status: HttpStatus.INTERNAL_SERVER_ERROR });
    expect(limiter.consumeUser).not.toHaveBeenCalled();
  });

  it('does not leak internal error details in a 503', async () => {
    limiter.consumeUser.mockRejectedValue(new Error('secret backend detail'));
    try {
      await guard.canActivate(executionContext({ principal: {
        userId: 'authenticated-synthetic-user', role: 'INVESTOR' as any, sessionId: 'session',
      } }));
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(503);
      expect(JSON.stringify((error as HttpException).getResponse())).not.toContain('secret backend detail');
    }
  });
});
