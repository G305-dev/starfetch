import request from 'supertest';
import {
  cleanDatabase,
  createTestApp,
  TestApp,
} from './utils/test-app';

/**
 * Dedicated throttle spec: runs with RATE_LIMIT_ENABLED=true (the main auth
 * suite disables throttling to stay deterministic). Login policy: 10 per
 * 10-minute window per client, so the 11th attempt must 429.
 */
describe('Rate limiting (enabled explicitly for this spec)', () => {
  let t: TestApp;

  beforeAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'true';
    t = await createTestApp();
  });

  afterAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    await cleanDatabase(t.prisma);
    await t.app.close();
  });

  it('login is throttled after the policy limit with a safe 429 envelope', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'brute@example.com', password: 'irrelevant passphrase 123' });
      expect(res.status).toBe(401); // limiter precedes the credential check failure
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    const blocked = await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email: 'brute@example.com', password: 'irrelevant passphrase 123' })
      .expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.context.retryAfterSeconds).toBeGreaterThan(0);
  });
});
