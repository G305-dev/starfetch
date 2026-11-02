import request from 'supertest';
import { UserRole } from '@prisma/client';
import {
  TestApp,
  cleanDatabase,
  createTestApp,
} from './utils/test-app';

const PASSWORD = 'a perfectly valid passphrase';

interface InvestorSession {
  accessToken: string;
  userId: string;
}

/** Full flow: register → verify via fake outbox → login. */
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

describe('Phase 2C — investor profile (e2e, real PostgreSQL)', () => {
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

  describe('GET /api/v1/me/profile', () => {
    it('rejects unauthenticated requests (401 UNAUTHENTICATED)', async () => {
      const res = await request(t.server).get('/api/v1/me/profile').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.error.requestId).toBeDefined();
    });

    it('returns only the authenticated investor\u2019s own profile with the User email', async () => {
      // A second investor exists but is never exposed.
      await createVerifiedInvestor(t, 'other@example.com');
      const me = await createVerifiedInvestor(t, 'owner@example.com');

      const res = await request(t.server)
        .get('/api/v1/me/profile')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);

      expect(res.body.data).toEqual({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'owner@example.com',
        phone: null,
      });
      expect(res.body.meta.requestId).toBeDefined();

      const user = await t.prisma.user.findUnique({ where: { id: me.userId } });
      expect(res.body.data.email).toBe(user!.email); // email sourced from User
      expect(res.body.data.email).not.toBe('other@example.com');
    });

    it('never exposes private/internal fields', async () => {
      const me = await createVerifiedInvestor(t, 'private@example.com');
      const res = await request(t.server)
        .get('/api/v1/me/profile')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);
      const s = JSON.stringify(res.body);
      for (const forbidden of ['passwordHash', 'normalizedEmail', 'tokenHash', 'codeHmac', 'sessionId']) {
        expect(res.body.data[forbidden]).toBeUndefined();
        expect(s).not.toContain(forbidden);
      }
      expect(s).not.toMatch(/argon2/i);
    });

    it('denies non-INVESTOR roles (403 FORBIDDEN)', async () => {
      const staff = await createVerifiedInvestor(t, 'staffish@example.com');
      // Elevate out-of-band (there is no public staff-registration surface).
      await t.prisma.user.update({ where: { id: staff.userId }, data: { role: UserRole.STAFF } });
      const login = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'staffish@example.com', password: PASSWORD })
        .expect(200);

      const res = await request(t.server)
        .get('/api/v1/me/profile')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/v1/me/profile', () => {
    it('rejects unauthenticated requests', async () => {
      await request(t.server)
        .put('/api/v1/me/profile')
        .send({ firstName: 'Grace' })
        .expect(401);
    });

    it('updates firstName/lastName (trimmed) and persists them', async () => {
      const me = await createVerifiedInvestor(t, 'edit@example.com');
      const res = await request(t.server)
        .put('/api/v1/me/profile')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .send({ firstName: '  Grace  ', lastName: ' Hopper ' })
        .expect(200);

      expect(res.body.data.firstName).toBe('Grace');
      expect(res.body.data.lastName).toBe('Hopper');
      expect(res.body.data.email).toBe('edit@example.com');

      const row = await t.prisma.investorProfile.findUnique({ where: { userId: me.userId } });
      expect(row?.firstName).toBe('Grace');
      expect(row?.lastName).toBe('Hopper');

      const fresh = await request(t.server)
        .get('/api/v1/me/profile')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .expect(200);
      expect(fresh.body.data.firstName).toBe('Grace');
    });

    it('saves the optional phone and supports clearing it with null', async () => {
      const me = await createVerifiedInvestor(t, 'phone@example.com');

      const saved = await request(t.server)
        .put('/api/v1/me/profile')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .send({ phone: '+234 801 234 5678' })
        .expect(200);
      expect(saved.body.data.phone).toBe('+234 801 234 5678');

      const row = await t.prisma.investorProfile.findUnique({ where: { userId: me.userId } });
      expect(row?.phone).toBe('+234 801 234 5678');

      const cleared = await request(t.server)
        .put('/api/v1/me/profile')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .send({ phone: null })
        .expect(200);
      expect(cleared.body.data.phone).toBeNull();
      expect(
        (await t.prisma.investorProfile.findUnique({ where: { userId: me.userId } }))?.phone,
      ).toBeNull();
    });

    it('email can never be changed through this endpoint', async () => {
      const me = await createVerifiedInvestor(t, 'locked@example.com');
      const res = await request(t.server)
        .put('/api/v1/me/profile')
        .set('Authorization', `Bearer ${me.accessToken}`)
        .send({ email: 'hijack@example.com' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');

      const user = await t.prisma.user.findUnique({ where: { id: me.userId } });
      expect(user?.email).toBe('locked@example.com');
    });

    it('ignores/denies attempts to target another user (no userId accepted)', async () => {
      const victim = await createVerifiedInvestor(t, 'victim@example.com');
      const attacker = await createVerifiedInvestor(t, 'attacker@example.com');

      // userId in body → rejected as unknown field; victim untouched.
      const res = await request(t.server)
        .put('/api/v1/me/profile')
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .send({ userId: victim.userId, firstName: 'Hacked' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');

      // userId in query → ignored entirely; own profile targeted only.
      await request(t.server)
        .put(`/api/v1/me/profile?userId=${victim.userId}`)
        .set('Authorization', `Bearer ${attacker.accessToken}`)
        .send({ firstName: 'Renamed' })
        .expect(200);

      const victimRow = await t.prisma.investorProfile.findUnique({ where: { userId: victim.userId } });
      expect(victimRow?.firstName).toBe('Ada');
      const attackerRow = await t.prisma.investorProfile.findUnique({
        where: { userId: attacker.userId },
      });
      expect(attackerRow?.firstName).toBe('Renamed');
    });

    it('rejects invalid data (empty names, bad phone format, empty body, junk fields)', async () => {
      const me = await createVerifiedInvestor(t, 'invalid@example.com');
      const auth = (req: request.Test) => req.set('Authorization', `Bearer ${me.accessToken}`);

      const r1 = await auth(request(t.server).put('/api/v1/me/profile').send({ firstName: '' })).expect(400);
      expect(r1.body.error.code).toBe('VALIDATION_FAILED');

      const r2 = await auth(request(t.server).put('/api/v1/me/profile').send({ phone: 'abc-xyz' })).expect(400);
      expect(r2.body.error.code).toBe('VALIDATION_FAILED');

      const r3 = await auth(request(t.server).put('/api/v1/me/profile').send({})).expect(400);
      expect(r3.body.error.code).toBe('VALIDATION_FAILED');

      const r4 = await auth(
        request(t.server).put('/api/v1/me/profile').send({ bvn: '12345678901', dateOfBirth: '1990-01-01' }),
      ).expect(400);
      expect(r4.body.error.code).toBe('VALIDATION_FAILED'); // unapproved KYC fields have no surface here

      const row = await t.prisma.investorProfile.findUnique({ where: { userId: me.userId } });
      expect(row?.firstName).toBe('Ada'); // nothing persisted
    });
  });
});
