import {
  Controller,
  Get,
  HttpCode,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import argon2 from 'argon2';
import request from 'supertest';
import { AccessTokenGuard } from '../src/modules/auth/guards/access-token.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { Roles } from '../src/common/guards/roles.decorator';
import { CookieMutationGuard } from '../src/common/security/cookie-mutation.guard';
import { KeyedRateLimit } from '../src/common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../src/common/rate-limit/keyed-rate-limit.guard';
import { JointAccount } from '../src/modules/joint/decorators/joint-account-context.decorator';
import {
  JOINT_ACCOUNT_PARAM,
  JointAccountContext,
  JointMembershipGuard,
} from '../src/modules/joint/guards/joint-membership.guard';
import { countActiveMembers, lockJointAccount } from '../src/modules/joint/joint-membership-tx';
import { JointModule } from '../src/modules/joint/joint.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ERROR_CODES } from '../src/common/errors/error-codes';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const PASSWORD = 'Tr0ub4dor&3starfetch';
const CSRF_HEADER = 'x-csrf-token';
const RATE_LIMITED_MESSAGE = 'Too many requests — please try again later.';

/**
 * TEST-ONLY probe controller exercising the Phase 3B Step-2 security stack.
 * Production joint REST endpoints are deliberately NOT implemented in this
 * step; these probes pin the guards' behavior without introducing business
 * surfaces.
 */
@Controller('probe-joint')
export class ProbeJointController {
  @Get(`:${JOINT_ACCOUNT_PARAM}/ping`)
  @Roles('INVESTOR')
  @UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard)
  ping(@JointAccount() ctx: JointAccountContext) {
    return { jointAccountId: ctx.jointAccountId, memberId: ctx.memberUserId };
  }

  @Post(`:${JOINT_ACCOUNT_PARAM}/mutate`)
  @HttpCode(200)
  @Roles('INVESTOR')
  @UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard, CookieMutationGuard)
  mutate(@JointAccount() ctx: JointAccountContext) {
    return { jointAccountId: ctx.jointAccountId };
  }

  @Post('keyed-user')
  @HttpCode(200)
  @Roles('INVESTOR')
  @KeyedRateLimit({ bucket: 'probe-keyed-user', limit: 2, windowSeconds: 3600, identity: 'user' })
  @UseGuards(AccessTokenGuard, RolesGuard, KeyedRateLimitGuard)
  keyedUser() {
    return { ok: true };
  }

  @Post(`:${JOINT_ACCOUNT_PARAM}/keyed-account`)
  @HttpCode(200)
  @Roles('INVESTOR')
  @KeyedRateLimit({
    bucket: 'probe-keyed-acct',
    limit: 2,
    windowSeconds: 3600,
    identity: 'user+account',
  })
  @UseGuards(AccessTokenGuard, RolesGuard, JointMembershipGuard, KeyedRateLimitGuard)
  keyedAccount(@JointAccount() ctx: JointAccountContext) {
    return { jointAccountId: ctx.jointAccountId };
  }

  // FAIL-CLOSED proof: keyed limiter attached WITHOUT an auth guard must 500,
  // never silently bypass.
  @Post('keyed-no-auth')
  @HttpCode(200)
  @KeyedRateLimit({ bucket: 'probe-keyed-noauth', limit: 2, windowSeconds: 3600, identity: 'user' })
  @UseGuards(KeyedRateLimitGuard)
  keyedNoAuth() {
    return { ok: true };
  }
}

interface AuthBundle {
  token: string;
  cookies: string[];
  csrfCookie: string;
}

describe('Phase 3B Step 2 — authorization & security foundation (e2e, real PostgreSQL, rate limits ON)', () => {
  let t: TestApp;

  let memberId: string;
  let outsiderId: string;
  let pendingId: string;
  let staffId: string;
  let acctA = '';
  let acctB = '';
  let member: AuthBundle;
  let outsider: AuthBundle;
  let pending: AuthBundle;
  let staff: AuthBundle;

  beforeAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'true'; // enabled for THIS spec's app only
    // Probe controllers live in their own module importing the REAL AuthModule
    // and JointModule so guard constructor injection resolves identically to
    // production wiring.
    @Module({ imports: [AuthModule, JointModule], controllers: [ProbeJointController] })
    class ProbeJointModule {}
    t = await createTestApp({ imports: [ProbeJointModule] });
    await cleanDatabase(t.prisma);

    memberId = (await makeVerifiedInvestor('member@starfetch.dev')).userId;
    outsiderId = (await makeVerifiedInvestor('outsider@starfetch.dev')).userId;
    pendingId = (await makeVerifiedInvestor('pending@starfetch.dev')).userId;
    staffId = (await makeVerifiedInvestor('staff@starfetch.dev')).userId;
    await t.prisma.user.update({ where: { id: staffId }, data: { role: 'STAFF' } });

    // Account A: member belongs (JOINT portfolio holding 999_999_00 kobo).
    acctA = await makeJointAccount(memberId, 999_999_00n);
    // Account B: same member belongs (proves per-account rate-limit keys).
    acctB = await makeJointAccount(memberId, null);
    // Pending invitation to pending@starfetch.dev on account A (invitee not a member).
    await t.prisma.jointAccountInvitation.create({
      data: {
        jointAccountId: acctA,
        invitedEmail: 'pending@starfetch.dev',
        invitedEmailNormalized: 'pending@starfetch.dev',
        invitedByUserId: memberId,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    // Member ALSO owns an individual portfolio value 100 kobo — isolation probe.
    const indiv = await t.prisma.portfolio.create({ data: { userId: memberId } });
    await t.prisma.holding.create({
      data: {
        portfolioId: indiv.id,
        instrumentLabel: 'Starfetch T-Bill 91-day',
        valueMinor: 100n,
        asOf: new Date(),
      },
    });
    // Joint-portfolio-only transaction that must never surface in /me/*.
    const jointPortfolio = await t.prisma.portfolio.findUnique({
      where: { jointAccountId: acctA },
    });
    if (!jointPortfolio) throw new Error('joint portfolio missing');
    await t.prisma.transaction.create({
      data: {
        portfolioId: jointPortfolio.id,
        type: 'DEPOSIT',
        status: 'CONFIRMED',
        amountMinor: 5_000n,
        description: 'JOINT-ONLY-SECRET-TRANSACTION',
        occurredAt: new Date(),
      },
    });

    member = await loginActive('member@starfetch.dev');
    outsider = await loginActive('outsider@starfetch.dev');
    pending = await loginActive('pending@starfetch.dev');
    staff = await loginActive('staff@starfetch.dev');
  }, 60_000);

  afterAll(async () => {
    await cleanDatabase(t.prisma);
    await t.app.close();
    // --runInBand shares one process; restore the default so later spec files
    // boot with the suite-standard "rate limits disabled" configuration.
    process.env.RATE_LIMIT_ENABLED = 'false';
  }, 30_000);

  async function makeVerifiedInvestor(email: string): Promise<{ userId: string }> {
    const res = await request(t.server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Joint', lastName: 'Tester', email, password: PASSWORD })
      .expect(201);
    const code = t.mailer.latestFor(email)?.code as string;
    await request(t.server)
      .post('/api/v1/auth/email/verify')
      .send({ verificationId: res.body.data.verificationId, code })
      .expect(200);
    return { userId: res.body.data.userId as string };
  }

  /** Direct DB user (for concurrency probes — must not consume auth buckets). */
  async function makeDbUser(email: string): Promise<string> {
    const user = await t.prisma.user.create({
      data: {
        email,
        normalizedEmail: email,
        passwordHash: await argon2.hash(PASSWORD),
        emailVerifiedAt: new Date(),
      },
    });
    return user.id;
  }

  async function makeJointAccount(userId: string, holdingValue: bigint | null): Promise<string> {
    const a = await t.prisma.jointAccount.create({
      data: {
        displayName: 'Home',
        createdByUserId: userId,
        members: { create: { userId } },
      },
    });
    const portfolio = await t.prisma.portfolio.create({ data: { jointAccountId: a.id } });
    if (holdingValue !== null) {
      await t.prisma.holding.create({
        data: {
          portfolioId: portfolio.id,
          instrumentLabel: 'Money Market Fund (Class A)',
          valueMinor: holdingValue,
          asOf: new Date(),
        },
      });
    }
    return a.id;
  }

  const cookieJar = (cookies: string[]) =>
    new Map(
      cookies.map((c) => {
        const pair = c.split(';')[0]; // name=value BEFORE attributes
        const eq = pair.indexOf('='); // first '=' (hmac is hex, no '=' inside)
        return [pair.slice(0, eq).trim(), decodeURIComponent(pair.slice(eq + 1).trim())];
      }),
    );
  // NOTE: supertest Cookie headers must be a SINGLE `; `-merged header line —
  // an array sends two header lines and cookie-parser only sees the first.

  async function loginActive(email: string): Promise<AuthBundle> {
    const res = await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const jar = cookieJar(cookies);
    return {
      token: res.body.data.accessToken as string,
      cookies,
      csrfCookie: jar.get('sf_csrf') as string,
    };
  }

  const ping = (id: string, token?: string) => {
    const r = request(t.server).get(`/api/v1/probe-joint/${id}/ping`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };

  // ── M-01 · JointMembershipGuard ──────────────────────────────────────────

  it('1) ACTIVE member passes; context injected with server-verified ids', async () => {
    const res = await ping(acctA, member.token).expect(200);
    expect(res.body.data.jointAccountId).toBe(acctA);
    expect(res.body.data.memberId).toBe(memberId);
  });

  it('2) unauthenticated request is rejected 401 before membership is consulted', async () => {
    const res = await ping(acctA).expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('3) authenticated non-member receives generic 404 (no 403 difference)', async () => {
    const res = await ping(acctA, outsider.token).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('4) unknown vs inaccessible vs malformed ids produce byte-identical 404 envelopes', async () => {
    const randomUuid = 'c3c6d497-2f0d-4f25-8a3f-6c47d54c9a00';
    const [unknown, outsiderHit, memberHit, malformed] = await Promise.all([
      ping(randomUuid, member.token),
      ping(acctA, outsider.token),
      ping(randomUuid, member.token),
      ping('not-a-uuid', member.token),
    ]);
    // requestId is a per-response correlation id (by design) — strip it before
    // the byte-identity and no-UUID-leak checks.
    const stripped = (body: Record<string, unknown>) => {
      const clone = JSON.parse(JSON.stringify(body)) as { error: Record<string, unknown> };
      delete clone.error?.requestId;
      return clone;
    };
    for (const r of [unknown, outsiderHit, memberHit, malformed]) {
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe('NOT_FOUND');
      expect(r.body.data).toBeUndefined();
      // No UUID (account ids, ids of other entities) leaks in the payload.
      expect(JSON.stringify(stripped(r.body).error)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    }
    expect(stripped(unknown.body)).toEqual(stripped(outsiderHit.body));
    expect(stripped(unknown.body)).toEqual(stripped(malformed.body));
    expect(stripped(unknown.body)).toEqual(stripped(memberHit.body));
  });

  it('5) STAFF role is denied 403 before membership (defense-in-depth, no account probing)', async () => {
    const res = await ping(acctA, staff.token).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('6) pending invitee (not yet a member) cannot access the account', async () => {
    const res = await ping(acctA, pending.token).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('7) revoking the session (logout) immediately voids joint access', async () => {
    const jar = cookieJar(member.cookies);
    await request(t.server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${member.token}`)
      .set('Cookie', `sf_refresh=${jar.get('sf_refresh')}; sf_csrf=${member.csrfCookie}`)
      .set(CSRF_HEADER, member.csrfCookie)
      .expect(200);
    // Same access token, same cookie jar — now rejected before membership check.
    const res = await ping(acctA, member.token).expect(401);
    expect(res.body.error.code).toBe(ERROR_CODES.UNAUTHENTICATED);
  });

  // ── M-02 · Individual↔joint isolation on existing /me/* contracts ───────

  it('8) individual /me surfaces NEVER include joint portfolio/holdings/transactions', async () => {
    // member's previous session was revoked in case 7; mint a fresh ACTIVE
    // session (also reused by the cookie-mutation cases below).
    member = await loginActive('member@starfetch.dev');
    const me = member;

    const portfolio = await request(t.server)
      .get('/api/v1/me/portfolio')
      .set('Authorization', `Bearer ${me.token}`)
      .expect(200);
    // 100 kobo individual ONLY — the 999,999.00 NGN joint holding is invisible.
    expect(portfolio.body.data.totalValueMinor).toBe(100);
    expect(portfolio.body.data.holdings).toHaveLength(1);
    expect(portfolio.body.data.holdings[0].instrumentLabel).toBe('Starfetch T-Bill 91-day');
    expect(JSON.stringify(portfolio.body.data)).not.toContain('99999900');

    const txs = await request(t.server)
      .get('/api/v1/me/transactions')
      .set('Authorization', `Bearer ${me.token}`)
      .expect(200);
    expect(
      (txs.body.data as Array<{ description?: string | null }>).every(
        (x) => x.description !== 'JOINT-ONLY-SECRET-TRANSACTION',
      ),
    ).toBe(true);
  });

  // ── M-03 · Cookie mutation guard: origin + session-bound signed CSRF ─────

  const mutate = (
    id: string,
    bundle: AuthBundle,
    opts: { origin?: string; csrf?: string | null; csrfCookieRaw?: string } = {},
  ) => {
    const jar = cookieJar(bundle.cookies);
    const r = request(t.server)
      .post(`/api/v1/probe-joint/${id}/mutate`)
      .set('Authorization', `Bearer ${bundle.token}`)
      .set(
        'Cookie',
        `sf_refresh=${jar.get('sf_refresh')}; sf_csrf=${opts.csrfCookieRaw ?? bundle.csrfCookie}`,
      );
    if (opts.origin) r.set('Origin', opts.origin);
    if (opts.csrf !== null) r.set(CSRF_HEADER, opts.csrf ?? bundle.csrfCookie);
    return r;
  };

  it('9) valid origin + valid session-bound CSRF passes; no-origin + valid CSRF passes (browser-list policy)', async () => {
    const res = await mutate(acctA, member, { origin: 'http://localhost:3000' }).expect(200);
    expect(res.body.data.jointAccountId).toBe(acctA);
    const noOrigin = await mutate(acctA, member).expect(200);
    expect(noOrigin.body.data.jointAccountId).toBe(acctA);
  });

  it('10) cross-site Origin is rejected 403 even with a perfect CSRF pair', async () => {
    const res = await mutate(acctA, member, { origin: 'https://evil.example' }).expect(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('11) missing/mismatched/tampered CSRF is rejected 403 CSRF_VALIDATION_FAILED', async () => {
    const missing = await mutate(acctA, member, { origin: 'http://localhost:3000', csrf: null });
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe(ERROR_CODES.CSRF_VALIDATION_FAILED);

    const wrongHeader = await mutate(acctA, member, {
      origin: 'http://localhost:3000',
      csrf: 'not-the-cookie-value',
    });
    expect(wrongHeader.status).toBe(403);
    expect(wrongHeader.body.error.code).toBe(ERROR_CODES.CSRF_VALIDATION_FAILED);

    // Matching-but-forged cookie+header pair must still fail: token integrity
    // is verified against the SESSION (sessionId embedded in the signed value),
    // so an attacker-crafted "consistent" pair can never verify.
    const forged = `v1.00000000000000000000000000000000.${member.csrfCookie.split('.')[2] ?? 'x'}`;
    const forgedPair = await mutate(acctA, member, {
      origin: 'http://localhost:3000',
      csrf: forged,
      csrfCookieRaw: forged,
    });
    expect(forgedPair.status).toBe(403);
    expect(forgedPair.body.error.code).toBe(ERROR_CODES.CSRF_VALIDATION_FAILED);
  });

  it('12) CSRF token minted for session A is rejected for session B (strictly session-bound)', async () => {
    const fresh = await loginActive('member@starfetch.dev');
    const jar = cookieJar(fresh.cookies);
    const res = await request(t.server)
      .post(`/api/v1/probe-joint/${acctA}/mutate`)
      .set('Authorization', `Bearer ${fresh.token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', `sf_refresh=${jar.get('sf_refresh')}; sf_csrf=${outsider.csrfCookie}`)
      .set(CSRF_HEADER, outsider.csrfCookie)
      .expect(403);
    expect(res.body.error.code).toBe(ERROR_CODES.CSRF_VALIDATION_FAILED);
  });

  // ── M-04 · Keyed (post-auth) rate limiting ────────────────────────────────

  it('13) keyed buckets are enforced per AUTHENTICATED PRINCIPAL, not trusting raw route params', async () => {
    // Unauthenticated → 401 before the keyed limiter can even run (ordering proof).
    const unauth = await request(t.server)
      .post('/api/v1/probe-joint/keyed-user')
      .expect(401);
    expect(unauth.body.error.code).toBe('UNAUTHENTICATED');

    // Cross-SESSION identities do NOT share buckets (no cross-token interference):
    // outsider: 2 succeeding calls, 3rd blocked — bucket follows the PRINCIPAL.
    await request(t.server)
      .post('/api/v1/probe-joint/keyed-user')
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(200);
    await request(t.server)
      .post('/api/v1/probe-joint/keyed-user')
      .set('Authorization', `Bearer ${pending.token}`)
      .expect(200); // pending has its own bucket
    await request(t.server)
      .post('/api/v1/probe-joint/keyed-user')
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(200);
    const outsiderBlocked = await request(t.server)
      .post('/api/v1/probe-joint/keyed-user')
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(429);
    expect(outsiderBlocked.body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
    expect(outsiderBlocked.body.error.message).toBe(RATE_LIMITED_MESSAGE);
    expect(outsiderBlocked.body.error.context.retryAfterSeconds).toBeGreaterThan(0);

    // member's own bucket is independent — outsider's exhaustion didn't touch it
    await request(t.server)
      .post('/api/v1/probe-joint/keyed-user')
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);
  });

  it('14) user+account buckets key on member VALIDATION, and fail closed without identity', async () => {
    for (let i = 0; i < 2; i++) {
      await request(t.server)
        .post(`/api/v1/probe-joint/${acctA}/keyed-account`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(200);
    }
    await request(t.server)
      .post(`/api/v1/probe-joint/${acctA}/keyed-account`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(429);
    // SAME user, DIFFERENT account → independent bucket
    await request(t.server)
      .post(`/api/v1/probe-joint/${acctB}/keyed-account`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);
    // Non-member: 404 BEFORE any bucket is consumed (membership runs first)
    const res = await request(t.server)
      .post(`/api/v1/probe-joint/${acctA}/keyed-account`)
      .set('Authorization', `Bearer ${pending.token}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    // Fail-closed: keyed limiter without an auth guard → 500 INTERNAL_ERROR,
    // never a silent bypass, and the bucket name never leaks.
    const failClosed = await request(t.server)
      .post('/api/v1/probe-joint/keyed-no-auth')
      .expect(500);
    expect(failClosed.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    expect(JSON.stringify(failClosed.body)).not.toContain('probe-keyed-noauth');
  });

  it('15) existing IP-level rate limiting is preserved (auth-login bucket still trips)', async () => {
    let tripped: request.Response | null = null;
    for (let i = 0; i < 20 && !tripped; i++) {
      const r = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@starfetch.dev', password: 'wrong-password-ok' });
      if (r.status === 429) tripped = r;
      else expect(r.status).toBe(401);
    }
    expect(tripped).not.toBeNull();
    expect(tripped?.body.error.code).toBe(ERROR_CODES.RATE_LIMITED);
  });

  // ── M-06 · Transactional membership utilities: global lock order ─────────

  it('16) concurrent capacity-guarded member inserts serialize → at most 2 members, no deadlock', async () => {
    const freshOwner = await makeDbUser('race-owner@starfetch.dev');
    const racerB = await makeDbUser('race-b@starfetch.dev');
    const racerC = await makeDbUser('race-c@starfetch.dev');
    const acct = await makeJointAccount(freshOwner, null); // exactly ONE member now

    // Emulates the approved accept-time capacity rule: parent lock FIRST,
    // then count + conditional insert — all inside ONE transaction.
    const attemptInsert = async (userId: string): Promise<'INSERTED' | 'CAPACITY_FULL'> =>
      t.prisma.$transaction(async (tx) => {
        const locked = await lockJointAccount(tx, acct); // 1) parent FIRST
        if (!locked) throw new Error('account vanished');
        const count = await countActiveMembers(tx, acct); // 2) capacity INSIDE lock
        if (count >= 2) return 'CAPACITY_FULL';
        await tx.jointAccountMember.create({ data: { jointAccountId: acct, userId } });
        return 'INSERTED';
      });

    const [r1, r2] = await Promise.all([attemptInsert(racerB), attemptInsert(racerC)]);
    expect([r1, r2].sort()).toEqual(['CAPACITY_FULL', 'INSERTED']);
    expect(await t.prisma.jointAccountMember.count({ where: { jointAccountId: acct } })).toBe(2);

    // lockJointAccount on a missing id returns null (no throw, no hang).
    const missing = await t.prisma.$transaction(async (tx) =>
      lockJointAccount(tx, 'c3c6d497-2f0d-4f25-8a3f-6c47d54c9a00'),
    );
    expect(missing).toBeNull();
  }, 30_000);
});
