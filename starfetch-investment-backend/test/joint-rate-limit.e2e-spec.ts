import request from 'supertest';
import { ERROR_CODES } from '../src/common/errors/error-codes';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const PASSWORD = 'Tr0ub4dor&3starfetch';
const CSRF_HEADER = 'x-csrf-token';

interface AuthBundle {
  userId: string;
  email: string;
  token: string;
  refresh: string;
  csrf: string;
}

/**
 * Step-4 correction 3 — REAL endpoint rate limiting. Rate limits are ENABLED
 * for this spec's app only; fixtures beyond the keyed thresholds are created
 * directly in the DB so auth IP buckets stay untouched and deterministic.
 *
 * DEV thresholds under test (pending business approval):
 *   joint-account-create      5/hper/user
 *   joint-invitation-create   5/hper/user+account
 *   joint-invitation-respond  20/hper/user (accept + decline share the bucket)
 */
describe('Phase 3B Step 4 — real mutation endpoint rate limiting (e2e, limits ON)', () => {
  let t: TestApp;
  let a: AuthBundle;
  let b: AuthBundle;
  let cc: AuthBundle;

  beforeAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'true'; // this spec's app instance only
    t = await createTestApp();
    await cleanDatabase(t.prisma);
    a = await makeVerifiedAndLogin('rl-creator@starfetch.dev', 'Rae', 'Limit');
    b = await makeVerifiedAndLogin('rl-invitee@starfetch.dev', 'Ben', 'Limit');
    cc = await makeVerifiedAndLogin('rl-other@starfetch.dev', 'Cleo', 'Limit');
  }, 60_000);

  afterAll(async () => {
    await cleanDatabase(t.prisma);
    await t.app.close();
    process.env.RATE_LIMIT_ENABLED = 'false'; // restore suite default (--runInBand process)
  }, 30_000);

  async function makeVerifiedAndLogin(email: string, fn: string, ln: string): Promise<AuthBundle> {
    const reg = await request(t.server)
      .post('/api/v1/auth/register')
      .send({ firstName: fn, lastName: ln, email, password: PASSWORD })
      .expect(201);
    const code = t.mailer.latestFor(email)?.code as string;
    await request(t.server)
      .post('/api/v1/auth/email/verify')
      .send({ verificationId: reg.body.data.verificationId, code })
      .expect(200);
    const res = await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const val = (name: string) => {
      const pair = cookies.find((x) => x.startsWith(`${name}=`))?.split(';')[0] ?? '';
      return decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
    };
    return {
      userId: reg.body.data.userId as string,
      email,
      token: res.body.data.accessToken as string,
      refresh: val('sf_refresh'),
      csrf: val('sf_csrf'),
    };
  }

  const post = (path: string, who: AuthBundle | null, body?: object) => {
    const base = request(t.server).post(`/api/v1${path}`);
    if (!who) return base.send(body ?? {});
    return base
      .set('Authorization', `Bearer ${who.token}`)
      .set('Cookie', `sf_refresh=${who.refresh}; sf_csrf=${who.csrf}`)
      .set(CSRF_HEADER, who.csrf)
      .send(body ?? {});
  };

  const expect429 = (r: request.Response) => {
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
    expect(r.body.error.context.retryAfterSeconds).toBeGreaterThan(0);
  };

  it('M1 rate limit: 5 creations/hour per USER; the 6th is 429 with retryAfter; another user on same IP has an independent bucket', async () => {
    for (let i = 0; i < 5; i++) {
      await post('/joint-accounts', a, { inviteeEmail: `rl-m1-${i}@starfetch.dev` }).expect(201);
    }
    expect429(await post('/joint-accounts', a, { inviteeEmail: 'rl-m1-x@starfetch.dev' }));
    // per-user separation (same IP address, different principal)
    await post('/joint-accounts', cc, { inviteeEmail: 'rl-m1-c@starfetch.dev' }).expect(201);
  });

  it('M2 rate limit: 5/hour per user+account; 6th on same account 429; SAME user on different account succeeds; auth+membership precede the limiter', async () => {
    const accRes = await t.prisma.jointAccount.create({
      data: { displayName: 'RL A', createdByUserId: a.userId, members: { create: { userId: a.userId } } },
    });
    const accOther = await t.prisma.jointAccount.create({
      data: { displayName: 'RL B', createdByUserId: a.userId, members: { create: { userId: a.userId } } },
    });
    for (let i = 0; i < 5; i++) {
      await post(`/joint-accounts/${accRes.id}/invitations`, a, { email: 'rl-target@starfetch.dev' }).expect(201); // same-email replacement each time
    }
    expect429(await post(`/joint-accounts/${accRes.id}/invitations`, a, { email: 'rl-target@starfetch.dev' }));
    // per-ACCOUNT separation: same user, second account has its own bucket
    await post(`/joint-accounts/${accOther.id}/invitations`, a, { email: 'rl-target@starfetch.dev' }).expect(201);
    // ordering: unauthenticated → 401 (not 429); authenticated non-member → 404 (not 429)
    expect((await post(`/joint-accounts/${accRes.id}/invitations`, null, { email: 'x@y.zz' })).status).toBe(401);
    expect((await post(`/joint-accounts/${accRes.id}/invitations`, cc, { email: 'x@y.zz' })).status).toBe(404);
  });

  it('M4 accept: 20/hour per user; the 21st accept is 429; unauthenticated caller gets 401 BEFORE limiter', async () => {
    // 21 fresh DB-created accounts each with a live PENDING invitation to B.
    const invitationIds: string[] = [];
    for (let i = 0; i < 21; i++) {
      const acc = await t.prisma.jointAccount.create({
        data: {
          displayName: `RL accept ${i}`,
          createdByUserId: a.userId,
          members: { create: { userId: a.userId } },
        },
      });
      const inv = await t.prisma.jointAccountInvitation.create({
        data: {
          jointAccountId: acc.id,
          invitedEmail: b.email,
          invitedEmailNormalized: b.email,
          invitedByUserId: a.userId,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      invitationIds.push(inv.id);
    }
    for (let i = 0; i < 20; i++) {
      await post(`/me/joint-invitations/${invitationIds[i]}/accept`, b).expect(200);
    }
    expect429(await post(`/me/joint-invitations/${invitationIds[20]}/accept`, b));
    // global ordering guarantees: identity must exist before any bucket is touched
    expect((await post(`/me/joint-invitations/${invitationIds[20]}/accept`, null)).status).toBe(401);
  }, 60_000);

  it('M5 decline: 20/hour per user (shared respond bucket); the 21st decline is 429', async () => {
    const invitationIds: string[] = [];
    for (let i = 0; i < 21; i++) {
      const acc = await t.prisma.jointAccount.create({
        data: {
          displayName: `RL decline ${i}`,
          createdByUserId: a.userId,
          members: { create: { userId: a.userId } },
        },
      });
      const inv = await t.prisma.jointAccountInvitation.create({
        data: {
          jointAccountId: acc.id,
          invitedEmail: cc.email,
          invitedEmailNormalized: cc.email,
          invitedByUserId: a.userId,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      invitationIds.push(inv.id);
    }
    for (let i = 0; i < 20; i++) {
      await post(`/me/joint-invitations/${invitationIds[i]}/decline`, cc).expect(200);
    }
    expect429(await post(`/me/joint-invitations/${invitationIds[20]}/decline`, cc));
  }, 60_000);

  it('global IP-level limits remain intact and unchanged (login bucket still trips at its existing threshold)', async () => {
    let tripped: request.Response | null = null;
    for (let i = 0; i < 12 && !tripped; i++) {
      const r = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'rl-ghost@starfetch.dev', password: 'wrong-password-ok' });
      if (r.status === 429) tripped = r;
      else expect(r.status).toBe(401);
    }
    expect(tripped).not.toBeNull();
    expect(tripped?.body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
  });
});
