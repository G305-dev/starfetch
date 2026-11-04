import request from 'supertest';
import { ERROR_CODES } from '../src/common/errors/error-codes';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const PASSWORD = 'Tr0ub4dor&3starfetch';
const CSRF_HEADER = 'x-csrf-token';

interface AuthBundle {
  token: string;
  cookies: string[];
  csrfCookie: string;
}

/** Deterministic timestamps (UTC, descending granularity) for ordering tests. */
const T = (m: number) => new Date(Date.UTC(2026, 0, 10, 12, 0, 0) + m * 60_000);

describe('Phase 3B Step 3 — Joint Investor READ APIs (e2e, real PostgreSQL)', () => {
  let t: TestApp;

  let idA = '';
  let idB = '';
  let idC = '';
  let idD = '';
  let idStaff = '';
  let acct1 = ''; // [A] single member, invitation PENDING to D, 2 holdings + 7 txs
  let acct2 = ''; // [A, B] two members, portfolio row with NO holdings/txs
  let acct3 = ''; // [C] member, NO portfolio row at all
  let a: AuthBundle;
  let b: AuthBundle;
  let c: AuthBundle;
  let d: AuthBundle;
  let staff: AuthBundle;

  beforeAll(async () => {
    // Rate limits remain suite-default OFF (test config); guards still active.
    t = await createTestApp();
    await cleanDatabase(t.prisma);

    idA = (await makeVerifiedInvestor('member-a@starfetch.dev', 'Member', 'Alpha')).userId;
    idB = (await makeVerifiedInvestor('member-b@starfetch.dev', 'Member', 'Beta')).userId;
    idC = (await makeVerifiedInvestor('outsider-c@starfetch.dev', 'Outsider', 'Gamma')).userId;
    idD = (await makeVerifiedInvestor('pending-d@starfetch.dev', 'Pending', 'Delta')).userId;
    idStaff = (await makeVerifiedInvestor('staff-e@starfetch.dev', 'Staff', 'Omega')).userId;
    await t.prisma.user.update({ where: { id: idStaff }, data: { role: 'STAFF' } });

    // ── Account 1: single member A, awaiting second holder; invitation to D.
    acct1 = await t.prisma.jointAccount
      .create({ data: { displayName: 'Home Savings', createdByUserId: idA } })
      .then((x) => x.id);
    await t.prisma.jointAccountMember.create({ data: { jointAccountId: acct1, userId: idA } });
    await t.prisma.jointAccountInvitation.create({
      data: {
        jointAccountId: acct1,
        invitedEmail: 'pending-d@starfetch.dev',
        invitedEmailNormalized: 'pending-d@starfetch.dev',
        invitedByUserId: idA,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });
    const p1 = await t.prisma.portfolio.create({ data: { jointAccountId: acct1 } });
    await t.prisma.holding.createMany({
      data: [
        {
          portfolioId: p1.id,
          instrumentLabel: 'Starfetch T-Bill 91-day',
          quantity: '1.500000',
          valueMinor: 137_550_000n, // ₦1,375,500.00
          asOf: T(2),
        },
        {
          portfolioId: p1.id,
          instrumentLabel: 'Money Market Fund (Class A)',
          quantity: null,
          valueMinor: 100_000_000n, // ₦1,000,000.00
          asOf: T(1),
        },
      ],
    });
    // 7 real transactions: two SHARE occurredAt T(3) (tie-break probe), one negative.
    const tie1 = await t.prisma.transaction.create({
      data: { portfolioId: p1.id, type: 'DEPOSIT', status: 'CONFIRMED', amountMinor: 500_000n, description: 'tie-1', occurredAt: T(3) },
    });
    const tie2 = await t.prisma.transaction.create({
      data: { portfolioId: p1.id, type: 'DEPOSIT', status: 'CONFIRMED', amountMinor: 600_000n, description: 'tie-2', occurredAt: T(3) },
    });
    for (let i = 0; i < 5; i++) {
      await t.prisma.transaction.create({
        data: {
          portfolioId: p1.id,
          type: i === 4 ? 'WITHDRAWAL' : 'DEPOSIT',
          status: 'CONFIRMED',
          amountMinor: BigInt((i + 1) * 100_000) * (i === 4 ? -1n : 1n), // last one: -500000_00? -> actually -(500000*100)? see note below
          description: `tx-${i}`,
          occurredAt: T(10 + i),
        },
      });
    }
    void tie1;
    void tie2;

    // ── Account 2: two members A+B, EMPTY portfolio row.
    acct2 = await t.prisma.jointAccount
      .create({ data: { displayName: 'Office Partners', createdByUserId: idA } })
      .then((x) => x.id);
    await t.prisma.jointAccountMember.createMany({
      data: [
        { jointAccountId: acct2, userId: idA },
        { jointAccountId: acct2, userId: idB },
      ],
    });
    await t.prisma.portfolio.create({ data: { jointAccountId: acct2 } }); // empty

    // ── Account 3: member C only, NO portfolio row whatsoever.
    acct3 = await t.prisma.jointAccount
      .create({ data: { displayName: 'Solo Venture', createdByUserId: idC } })
      .then((x) => x.id);
    await t.prisma.jointAccountMember.create({ data: { jointAccountId: acct3, userId: idC } });

    // ── A ALSO owns an individual portfolio — isolation probes.
    const indiv = await t.prisma.portfolio.create({ data: { userId: idA } });
    await t.prisma.holding.create({
      data: {
        portfolioId: indiv.id,
        instrumentLabel: 'Individual One',
        valueMinor: 55_500n,
        asOf: new Date(),
      },
    });
    await t.prisma.transaction.create({
      data: {
        portfolioId: indiv.id,
        type: 'DEPOSIT',
        status: 'CONFIRMED',
        amountMinor: 1_000n,
        description: 'INDIVIDUAL-ONLY',
        occurredAt: new Date(),
      },
    });

    a = await login('member-a@starfetch.dev');
    b = await login('member-b@starfetch.dev');
    c = await login('outsider-c@starfetch.dev');
    d = await login('pending-d@starfetch.dev');
    staff = await login('staff-e@starfetch.dev');
  }, 60_000);

  afterAll(async () => {
    await cleanDatabase(t.prisma);
    await t.app.close();
  }, 30_000);

  async function makeVerifiedInvestor(
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<{ userId: string }> {
    const res = await request(t.server)
      .post('/api/v1/auth/register')
      .send({ firstName, lastName, email, password: PASSWORD })
      .expect(201);
    const code = t.mailer.latestFor(email)?.code as string;
    await request(t.server)
      .post('/api/v1/auth/email/verify')
      .send({ verificationId: res.body.data.verificationId, code })
      .expect(200);
    return { userId: res.body.data.userId as string };
  }

  const cookieValue = (rawCookies: string[], name: string): string => {
    const entry = rawCookies.find((x) => x.startsWith(`${name}=`));
    if (!entry) throw new Error(`cookie ${name} missing`);
    const pair = entry.split(';')[0];
    return decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
  };

  async function login(email: string): Promise<AuthBundle> {
    const res = await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    return {
      token: res.body.data.accessToken as string,
      cookies,
      csrfCookie: cookieValue(cookies, 'sf_csrf'),
    };
  }

  const get = (path: string, bundle?: AuthBundle) => {
    const r = request(t.server).get(`/api/v1${path}`);
    return bundle ? r.set('Authorization', `Bearer ${bundle.token}`) : r;
  };

  // ─────────────────────────── R1 · list my joint accounts ──────────────────

  it('R1: member with TWO memberships sees exactly those accounts with documented summary fields', async () => {
    const res = await get('/me/joint-accounts', a).expect(200);
    expect(res.body.meta.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.data).toHaveLength(2);
    // deterministic order: asc by joinedAt (acct1 joined before acct2)
    const [s1, s2] = res.body.data as Array<Record<string, unknown>>;
    expect(Object.keys(s1).sort()).toEqual(
      ['awaitingSecondHolder', 'displayName', 'holderNames', 'isFull', 'jointAccountId', 'memberCount', 'myJoinedAt'],
    );
    expect(s1.jointAccountId).toBe(acct1);
    expect(s1.displayName).toBe('Home Savings');
    expect(s1.memberCount).toBe(1);
    expect(s1.holderNames).toEqual(['Member Alpha']);
    expect(s1.isFull).toBe(false);
    expect(s1.awaitingSecondHolder).toBe(true);
    expect(String(s1.myJoinedAt)).toMatch(/T.*Z$/);

    expect(s2.jointAccountId).toBe(acct2);
    expect(s2.memberCount).toBe(2);
    expect(s2.holderNames).toHaveLength(2);
    expect(s2.holderNames).toEqual(expect.arrayContaining(['Member Alpha', 'Member Beta']));
    expect(s2.isFull).toBe(true);
    expect(s2.awaitingSecondHolder).toBe(false);
  });

  it('R1: each membership is isolated — C sees ONLY account 3; pending invitee D sees [] (invitation grants nothing)', async () => {
    const cRes = await get('/me/joint-accounts', c).expect(200);
    expect(cRes.body.data).toHaveLength(1);
    expect((cRes.body.data as Array<{ jointAccountId: string }>)[0].jointAccountId).toBe(acct3);
    expect(JSON.stringify(cRes.body.data)).not.toContain(acct1);
    expect(JSON.stringify(cRes.body.data)).not.toContain(acct2);

    const dRes = await get('/me/joint-accounts', d).expect(200);
    expect(dRes.body.data).toEqual([]);
  });

  it('R1: unauthenticated → 401; STAFF role → 403 (no JOINT role introduced)', async () => {
    expect((await get('/me/joint-accounts').expect(401)).body.error.code).toBe('UNAUTHENTICATED');
    expect((await get('/me/joint-accounts', staff).expect(403)).body.error.code).toBe('FORBIDDEN');
  });

  // ─────────────────────────── R2 · account detail ──────────────────────────

  it('R2: member retrieves detail with approved holder info ONLY (no credentials/session/KYC fields)', async () => {
    const res = await get(`/joint-accounts/${acct1}`, a).expect(200);
    const data = res.body.data;
    expect(data.jointAccountId).toBe(acct1);
    expect(data.displayName).toBe('Home Savings');
    expect(String(data.createdAt)).toMatch(/T.*Z$/);
    expect(data.members).toHaveLength(1);
    const m = data.members[0] as Record<string, unknown>;
    expect(Object.keys(m).sort()).toEqual(['email', 'firstName', 'joinedAt', 'lastName', 'userId']);
    expect(m.userId).toBe(idA);
    expect(m.firstName).toBe('Member');
    expect(m.lastName).toBe('Alpha');
    expect(m.email).toBe('member-a@starfetch.dev');
    // No sensitive fields anywhere in the payload graph.
    const blob = JSON.stringify(res.body);
    for (const banned of ['passwordHash', 'emailVerifiedAt', 'phone', 'role', 'session', 'csrf']) {
      expect(blob).not.toContain(banned);
    }
    expect(data.membership).toEqual({ capacity: 2, activeCount: 1, awaitingSecondHolder: true });
    expect(res.body.meta.requestId).toBeDefined();
  });

  it('R2: second member B reads the SAME two-member account; state not "awaiting" anymore', async () => {
    const res = await get(`/joint-accounts/${acct2}`, b).expect(200);
    expect(res.body.data.members).toHaveLength(2);
    expect(res.body.data.membership).toEqual({ capacity: 2, activeCount: 2, awaitingSecondHolder: false });
    const ids = (res.body.data.members as Array<{ userId: string }>).map((x) => x.userId).sort();
    expect(ids).toEqual([idA, idB].sort());
  });

  it('R2: unauthorized/pending/unknown/malformed all get the IDENTICAL generic 404', async () => {
    const unknown = await get(`/joint-accounts/c3c6d497-2f0d-4f25-8a3f-6c47d54c9a00`, a).expect(404);
    const outsider = await get(`/joint-accounts/${acct1}`, c).expect(404);
    const pend = await get(`/joint-accounts/${acct1}`, d).expect(404);
    const malformed = await get(`/joint-accounts/not-a-uuid`, a).expect(404);
    for (const r of [unknown, outsider, pend, malformed]) {
      expect(r.body.error.code).toBe('NOT_FOUND');
      expect(r.body.error.message).toBe('Account not found.');
      expect(r.body.data).toBeUndefined();
    }
  });

  // ─────────────────────────── R3 · joint portfolio ─────────────────────────

  it('R3: real stored holdings, exact minor-unit totals, NGN, null return, isDemo:false', async () => {
    const res = await get(`/joint-accounts/${acct1}/portfolio`, a).expect(200);
    const data = res.body.data;
    expect(Object.keys(data).sort()).toEqual(
      ['currency', 'holdingCount', 'holdings', 'totalReturnMinor', 'totalValueMinor'],
    );
    expect(data.currency).toBe('NGN');
    expect(data.totalValueMinor).toBe(237_550_000); // exact int handshake — no float drift
    expect(data.holdingCount).toBe(2);
    expect(data.totalReturnMinor).toBeNull();
    expect(res.body.meta.asOf).toBeDefined();
    expect(res.body.meta.requestId).toBeDefined();

    const [h1, h2] = data.holdings as Array<Record<string, unknown>>;
    for (const h of [h1, h2]) {
      expect(Object.keys(h).sort()).toEqual(
        ['asOf', 'currency', 'id', 'instrumentLabel', 'isDemo', 'quantity', 'valueMinor'],
      );
      expect(h.isDemo).toBe(false);
      expect(h.currency).toBe('NGN');
    }
    // ordered by asOf desc: T-Bill (T(2)) first
    expect(h1.instrumentLabel).toBe('Starfetch T-Bill 91-day');
    expect(h1.quantity).toBe('1.5'); // Decimal → string, EXACT Phase-2D serializer behavior
    expect(h1.valueMinor).toBe(137_550_000);
    expect(h2.instrumentLabel).toBe('Money Market Fund (Class A)');
    expect(h2.quantity).toBeNull();
    expect(h2.valueMinor).toBe(100_000_000);
  });

  it('R3: holding/transaction shapes are byte-identical in KEYS to approved /me/portfolio (parity contract)', async () => {
    const joint = await get(`/joint-accounts/${acct1}/portfolio`, a).expect(200);
    const me = await request(t.server)
      .get('/api/v1/me/portfolio')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(Object.keys(joint.body.data).sort()).toEqual(Object.keys(me.body.data).sort());
    expect(Object.keys(joint.body.data.holdings[0]).sort()).toEqual(
      Object.keys(me.body.data.holdings[0]).sort(),
    );
    expect(Object.keys(joint.body.meta).sort()).toEqual(Object.keys(me.body.meta).sort());
  });

  it('R3: empty joint portfolio ⇒ honest zero-state (exists but empty); account WITHOUT portfolio ⇒ same zero-state', async () => {
    const empty = await get(`/joint-accounts/${acct2}/portfolio`, a).expect(200);
    expect(empty.body.data).toEqual({
      currency: 'NGN',
      totalValueMinor: 0,
      holdingCount: 0,
      totalReturnMinor: null,
      holdings: [],
    });
    const none = await get(`/joint-accounts/${acct3}/portfolio`, c).expect(200);
    expect(none.body.data).toEqual(empty.body.data);
  });

  it('R3: unauthorized/pending/unauthenticated are rejected; joint holding NEVER via /me/* (isolation)', async () => {
    expect((await get(`/joint-accounts/${acct1}/portfolio`, c).expect(404)).body.error.code).toBe('NOT_FOUND');
    expect((await get(`/joint-accounts/${acct1}/portfolio`, d).expect(404)).body.error.code).toBe('NOT_FOUND');
    expect((await get(`/joint-accounts/${acct1}/portfolio`).expect(401)).body.error.code).toBe('UNAUTHENTICATED');

    // A's individual view contains ONLY individual data.
    const me = await request(t.server)
      .get('/api/v1/me/portfolio')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(me.body.data.totalValueMinor).toBe(55_500);
    expect(me.body.data.holdings).toHaveLength(1);
    expect(me.body.data.holdings[0].instrumentLabel).toBe('Individual One');
  });

  // ─────────────────────────── R4 · joint transactions ──────────────────────

  it('R4: real rows only, newest-first ordering with stable id desc tie-break, signed amounts preserved', async () => {
    const res = await get(`/joint-accounts/${acct1}/transactions`, a).expect(200);
    expect(res.body.data).toHaveLength(7);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(20);
    expect(res.body.meta.total).toBe(7);
    expect(res.body.meta.requestId).toBeDefined();

    const rows = res.body.data as Array<Record<string, unknown>>;
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(
        ['amountMinor', 'currency', 'description', 'id', 'occurredAt', 'status', 'type'],
      );
    }
    expect(rows[0].description).toBe('tx-4'); // newest occurredAt
    expect(rows[0].amountMinor).toBeLessThan(0); // signed debit preserved exactly
    const tie = rows.filter((x) => x.description === 'tie-1' || x.description === 'tie-2');
    expect(tie).toHaveLength(2);
    // identical occurredAt → tie-broken by id desc
    expect(tie[0].occurredAt).toBe(tie[1].occurredAt);
    expect(String(tie[0].id) > String(tie[1].id)).toBe(true);
    // strictly non-increasing occurredAt across the page
    for (let i = 1; i < rows.length; i++) {
      expect(String(rows[i - 1].occurredAt) >= String(rows[i].occurredAt)).toBe(true);
    }
  });

  it('R4: pagination across multiple pages; beyond-range page is empty with correct total', async () => {
    const p1 = await get(`/joint-accounts/${acct1}/transactions?page=1&pageSize=3`, a).expect(200);
    const p2 = await get(`/joint-accounts/${acct1}/transactions?page=2&pageSize=3`, a).expect(200);
    const p3 = await get(`/joint-accounts/${acct1}/transactions?page=3&pageSize=3`, a).expect(200);
    const p4 = await get(`/joint-accounts/${acct1}/transactions?page=4&pageSize=3`, a).expect(200);
    expect(p1.body.data).toHaveLength(3);
    expect(p2.body.data).toHaveLength(3);
    expect(p3.body.data).toHaveLength(1);
    expect(p4.body.data).toHaveLength(0);
    expect(p4.body.meta.total).toBe(7);
    expect(p4.body.meta.page).toBe(4);
    const ids = new Set(
      [...p1.body.data, ...p2.body.data, ...p3.body.data].map((r: { id: string }) => r.id),
    );
    expect(ids.size).toBe(7); // full coverage, no duplicates
  });

  it('R4: invalid pagination params → 400 VALIDATION_FAILED (Nest order: membership guard runs BEFORE pipes — a non-member still gets 404)', async () => {
    for (const q of ['page=0', 'pageSize=101', 'pageSize=0', 'page=abc']) {
      const r = await get(`/joint-accounts/${acct1}/transactions?${q}`, a).expect(400);
      expect(r.body.error.code).toBe('VALIDATION_FAILED');
    }
    // Unauthorized callers cannot even probe validation differences.
    const outsider = await get(`/joint-accounts/${acct1}/transactions?page=0`, c).expect(404);
    expect(outsider.body.error.code).toBe('NOT_FOUND');
  });

  it('R4: cross-account access and pending invitee rejected; empty accounts return [] total 0', async () => {
    expect((await get(`/joint-accounts/${acct1}/transactions`, c).expect(404)).body.error.code).toBe('NOT_FOUND');
    expect((await get(`/joint-accounts/${acct1}/transactions`, d).expect(404)).body.error.code).toBe('NOT_FOUND');
    const empty = await get(`/joint-accounts/${acct2}/transactions`, b).expect(200);
    expect(empty.body.data).toEqual([]);
    expect(empty.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 0 });
    const absent = await get(`/joint-accounts/${acct3}/transactions`, c).expect(200);
    expect(absent.body.meta.total).toBe(0);
  });

  // ─────────────────────── sessions & isolation guarantees ─────────────────

  it('revoked session loses joint access IMMEDIATELY (logout → all four routes 401)', async () => {
    // dedicated fresh login for revocable session
    const rev = await login('member-b@starfetch.dev');
    const cookie = `sf_refresh=${cookieValue(rev.cookies, 'sf_refresh')}; sf_csrf=${rev.csrfCookie}`;
    await request(t.server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${rev.token}`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER, rev.csrfCookie)
      .expect(200);
    for (const path of [
      `/me/joint-accounts`,
      `/joint-accounts/${acct2}`,
      `/joint-accounts/${acct2}/portfolio`,
      `/joint-accounts/${acct2}/transactions`,
    ]) {
      const r = await get(path, rev).expect(401);
      expect(r.body.error.code).toBe(ERROR_CODES.UNAUTHENTICATED);
    }
  });

  it('individual transactions NEVER include joint rows (and vice versa — A sees joint only under joint routes)', async () => {
    const meTx = await request(t.server)
      .get('/api/v1/me/transactions')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect((meTx.body.data as Array<{ description: string }>).map((x) => x.description)).toEqual([
      'INDIVIDUAL-ONLY',
    ]);

    const jointTx = await get(`/joint-accounts/${acct1}/transactions`, a).expect(200);
    expect(JSON.stringify(jointTx.body.data)).not.toContain('INDIVIDUAL-ONLY');
  });
});
