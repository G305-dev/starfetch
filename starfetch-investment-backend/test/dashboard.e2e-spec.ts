import request from 'supertest';
import { UserRole } from '@prisma/client';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const PASSWORD = 'a perfectly valid passphrase';

interface InvestorSession {
  accessToken: string;
  userId: string;
}

async function createVerifiedInvestor(t: TestApp, email: string): Promise<InvestorSession> {
  const reg = await request(t.server)
    .post('/api/v1/auth/register')
    .send({ firstName: 'Ada', lastName: 'Lovelace', email, password: PASSWORD })
    .expect(201);
  const code = t.mailer.latestFor(email)!.code;
  await request(t.server)
    .post('/api/v1/auth/email/verify')
    .send({ verificationId: reg.body.data.verificationId, code })
    .expect(200);
  const login = await request(t.server)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return { accessToken: login.body.data.accessToken, userId: login.body.data.user.id };
}

/** Synthetic ledger rows, written directly for tests (the app exposes NO write APIs in 2D). */
async function seedPortfolio(
  t: TestApp,
  userId: string,
  holdings: Array<{ label: string; valueMinor: bigint | number }>,
) {
  const portfolio = await t.prisma.portfolio.create({ data: { userId } });
  for (const [i, h] of holdings.entries()) {
    await t.prisma.holding.create({
      data: {
        portfolioId: portfolio.id,
        instrumentLabel: h.label,
        quantity: i === 0 ? '2.500000' : null,
        valueMinor: BigInt(h.valueMinor),
        asOf: new Date(Date.UTC(2026, 10, 1 + i, 9, 0, 0)),
      },
    });
  }
  return portfolio;
}

async function seedTransactions(t: TestApp, portfolioId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await t.prisma.transaction.create({
      data: {
        portfolioId,
        type: 'DEPOSIT',
        status: 'CONFIRMED',
        amountMinor: BigInt(1000 + i),
        description: `synthetic tx ${i}`,
        occurredAt: new Date(Date.UTC(2026, 10, 1, 8 + i, 0, 0)), // later i = newer
      },
    });
  }
}

describe('Phase 2D — investor dashboard read APIs (e2e, real PostgreSQL)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => {
    await cleanDatabase(t.prisma);
    await t.app.close();
  });
  beforeEach(async () => {
    await cleanDatabase(t.prisma);
    t.mailer.outbox.length = 0;
  });

  describe('GET /api/v1/me/portfolio', () => {
    it('rejects unauthenticated requests (401 UNAUTHENTICATED)', async () => {
      const res = await request(t.server).get('/api/v1/me/portfolio').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.requestId).toBeDefined();
    });

    it('new investor receives a REAL empty state — no seeded/fake holdings are created', async () => {
      const me = await createVerifiedInvestor(t, 'fresh@example.com');
      const res = await request(t.server)
        .get('/api/v1/me/portfolio')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);

      expect(res.body.data).toEqual({
        currency: 'NGN',
        totalValueMinor: 0,
        holdingCount: 0,
        totalReturnMinor: null,
        holdings: [],
      });
      expect(res.body.meta.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(res.body.meta.requestId).toBeDefined();

      // Nothing was materialized merely to populate the dashboard.
      expect(await t.prisma.portfolio.count()).toBe(0);
      expect(await t.prisma.holding.count()).toBe(0);
    });

    it('denies non-INVESTOR roles (403 FORBIDDEN)', async () => {
      const staff = await createVerifiedInvestor(t, 'staff@example.com');
      await t.prisma.user.update({ where: { id: staff.userId }, data: { role: UserRole.STAFF } });
      const login = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'staff@example.com', password: PASSWORD })
        .expect(200);
      const res = await request(t.server)
        .get('/api/v1/me/portfolio')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('cannot target another user (userId query is ignored — ownership is the principal)', async () => {
      const holder = await createVerifiedInvestor(t, 'holder@example.com');
      const peeker = await createVerifiedInvestor(t, 'peeker@example.com');
      await seedPortfolio(t, holder.userId, [{ label: 'T-Bill 91D', valueMinor: 500_000 }]);

      const res = await request(t.server)
        .get(`/api/v1/me/portfolio?userId=${holder.userId}`)
        .set('Authorization', `Bearer ${peeker.accessToken}`)
        .expect(200); // ignored parameter → own (empty) portfolio only
      expect(res.body.data.totalValueMinor).toBe(0);
      expect(res.body.data.holdings).toEqual([]);
    });

    it('scopes portfolio data to the authenticated investor and aggregates STORED values only', async () => {
      const owner = await createVerifiedInvestor(t, 'owner@example.com');
      const other = await createVerifiedInvestor(t, 'someone@example.com');
      await seedPortfolio(t, owner.userId, [
        { label: 'T-Bill 91D', valueMinor: 1_000_000 },
        { label: 'Money Market Fund', valueMinor: 2_500_000 },
      ]);
      await seedPortfolio(t, other.userId, [{ label: 'FGN Bond', valueMinor: 7_700_000 }]);

      const res = await request(t.server)
        .get('/api/v1/me/portfolio')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(res.body.data.totalValueMinor).toBe(3_500_000); // Σ of stored values only — no valuation math
      expect(res.body.data.holdingCount).toBe(2);
      expect(res.body.data.totalReturnMinor).toBeNull(); // no approved return calculation exists
      expect(res.body.data.holdings.map((h: { instrumentLabel: string }) => h.instrumentLabel).sort()).toEqual(
        ['Money Market Fund', 'T-Bill 91D'],
      );
      const first = res.body.data.holdings[0];
      expect(first.currency).toBe('NGN');
      expect(first.isDemo).toBe(false);
      expect(first.asOf).toMatch(/^\d{4}-/);
      expect(first.quantity === null || typeof first.quantity === 'string').toBe(true);
      // No hint of the other investor's 7_700_000 or labels.
      expect(JSON.stringify(res.body)).not.toContain('7700000');
      expect(JSON.stringify(res.body)).not.toContain('FGN Bond');
    });
  });

  describe('GET /api/v1/me/transactions', () => {
    it('rejects unauthenticated requests (401 UNAUTHENTICATED)', async () => {
      const res = await request(t.server).get('/api/v1/me/transactions').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('new investor receives an empty transaction list with pagination meta', async () => {
      const me = await createVerifiedInvestor(t, 'newbie@example.com');
      const res = await request(t.server)
        .get('/api/v1/me/transactions?page=1&pageSize=5')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(5);
      expect(res.body.meta.total).toBe(0);
      expect(res.body.meta.requestId).toBeDefined();
    });

    it('denies non-INVESTOR roles (403 FORBIDDEN)', async () => {
      const staff = await createVerifiedInvestor(t, 'stafftx@example.com');
      await t.prisma.user.update({ where: { id: staff.userId }, data: { role: UserRole.ADMIN } });
      const login = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'stafftx@example.com', password: PASSWORD })
        .expect(200);
      const res = await request(t.server)
        .get('/api/v1/me/transactions')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a userId targeting attempt (unknown query field → 400)', async () => {
      const me = await createVerifiedInvestor(t, 'txme@example.com');
      const res = await request(t.server)
        .get(`/api/v1/me/transactions?userId=${me.userId}&page=1`)
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('scopes transaction data to the authenticated investor', async () => {
      const owner = await createVerifiedInvestor(t, 'txowner@example.com');
      const other = await createVerifiedInvestor(t, 'txother@example.com');
      const p1 = await seedPortfolio(t, owner.userId, []);
      const p2 = await seedPortfolio(t, other.userId, []);
      await seedTransactions(t, p1.id, 3);
      await seedTransactions(t, p2.id, 2);

      const res = await request(t.server)
        .get('/api/v1/me/transactions?page=1&pageSize=10')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data).toHaveLength(3);
      // Newest first (occurredAt desc): i=2 newest → amountMinor 1002.
      expect(res.body.data[0].amountMinor).toBe(1_002);
      expect(res.body.data[2].amountMinor).toBe(1_000);
      const row = res.body.data[0];
      expect(row.currency).toBe('NGN');
      expect(row.type).toBe('DEPOSIT');
      expect(row.status).toBe('CONFIRMED');
      expect(row.occurredAt).toMatch(/^\d{4}-/);
      // Other investor sees own rows only.
      const otherRes = await request(t.server)
        .get('/api/v1/me/transactions')
        .set('Authorization', `Bearer ${other.accessToken}`)
        .expect(200);
      expect(otherRes.body.meta.total).toBe(2);
    });

    it('paginates correctly (page/pageSize windows over totals)', async () => {
      const me = await createVerifiedInvestor(t, 'pager@example.com');
      const p = await seedPortfolio(t, me.userId, []);
      await seedTransactions(t, p.id, 7);

      const page1 = await request(t.server)
        .get('/api/v1/me/transactions?page=1&pageSize=5')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);
      expect(page1.body.data).toHaveLength(5);
      expect(page1.body.meta).toMatchObject({ page: 1, pageSize: 5, total: 7 });

      const page2 = await request(t.server)
        .get('/api/v1/me/transactions?page=2&pageSize=5')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);
      expect(page2.body.data).toHaveLength(2);
      expect(page2.body.meta).toMatchObject({ page: 2, pageSize: 5, total: 7 });

      const ids = new Set([...page1.body.data, ...page2.body.data].map((r: { id: string }) => r.id));
      expect(ids.size).toBe(7); // no overlap, no loss

      const beyond = await request(t.server)
        .get('/api/v1/me/transactions?page=3&pageSize=5')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);
      expect(beyond.body.data).toEqual([]);
      expect(beyond.body.meta.total).toBe(7);
    });

    it('rejects invalid pagination (400)', async () => {
      const me = await createVerifiedInvestor(t, 'badpage@example.com');
      for (const qs of ['page=0', 'pageSize=0', 'pageSize=101', 'page=abc']) {
        const res = await request(t.server)
          .get(`/api/v1/me/transactions?${qs}`)
          .set('Authorization', `Bearer ${me.accessToken}`)
          .expect(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });
});
