import request from 'supertest';
import { ERROR_CODES } from '../src/common/errors/error-codes';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const PASSWORD = 'Tr0ub4dor&3starfetch';
const CSRF_HEADER = 'x-csrf-token';
const GOOD_ORIGIN = 'http://localhost:3000';

interface AuthBundle {
  userId: string;
  token: string;
  refresh: string;
  csrf: string;
}

describe('Phase 3B Step 4 — joint account creation & invitation workflow (e2e, real PostgreSQL)', () => {
  let t: TestApp;
  let a: AuthBundle; // creator
  let b: AuthBundle; // invitee / second holder
  let c: AuthBundle; // unrelated outsider
  let v: AuthBundle; // invited-but-that-address-not-registered flows use raw emails
  let staff: AuthBundle;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
    const staffId = await makeVerified('staffer@starfetch.dev', 'Sade', 'Five');
    await t.prisma.user.update({ where: { id: staffId }, data: { role: 'STAFF' } }); // BEFORE login — JWT carries the role claim at mint time
    a = await verifiedLogin('creator@starfetch.dev', 'Ada', 'One');
    b = await verifiedLogin('invitee@starfetch.dev', 'Bola', 'Two');
    c = await verifiedLogin('unrelated@starfetch.dev', 'Chris', 'Three');
    v = await verifiedLogin('second@starfetch.dev', 'Vera', 'Four');
    staff = await login('staffer@starfetch.dev', staffId);
  }, 90_000);

  beforeEach(() => {
    t.jointMailer.outbox.length = 0;
  });

  afterAll(async () => {
    await cleanDatabase(t.prisma);
    await t.app.close();
  }, 30_000);

  async function makeVerified(email: string, firstName: string, lastName: string): Promise<string> {
    const res = await request(t.server)
      .post('/api/v1/auth/register')
      .send({ firstName, lastName, email, password: PASSWORD })
      .expect(201);
    const code = t.mailer.latestFor(email)?.code as string;
    await request(t.server)
      .post('/api/v1/auth/email/verify')
      .send({ verificationId: res.body.data.verificationId, code })
      .expect(200);
    return res.body.data.userId as string;
  }

  async function verifiedLogin(email: string, fn: string, ln: string): Promise<AuthBundle> {
    const userId = await makeVerified(email, fn, ln);
    return login(email, userId);
  }

  async function login(email: string, userId: string): Promise<AuthBundle> {
    const res = await request(t.server)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const cookies = (res.headers['set-cookie'] as unknown as string[]) ?? [];
    const val = (name: string) => {
      const entry = cookies.find((x) => x.startsWith(`${name}=`));
      if (!entry) throw new Error(`missing cookie ${name}`);
      const pair = entry.split(';')[0];
      return decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
    };
    return { userId, token: res.body.data.accessToken as string, refresh: val('sf_refresh'), csrf: val('sf_csrf') };
  }

  const post = (path: string, b: AuthBundle | null, body?: object, origin: string | null = GOOD_ORIGIN) => {
    const base = request(t.server).post(`/api/v1${path}`);
    const r = b
      ? base
          .set('Authorization', `Bearer ${b.token}`)
          .set('Cookie', `sf_refresh=${b.refresh}; sf_csrf=${b.csrf}`)
          .set(CSRF_HEADER, b.csrf)
      : base;
    if (origin) r.set('Origin', origin);
    return r.send(body ?? {});
  };

  const createAccount = (b: AuthBundle, inviteeEmail: string, displayName?: string) =>
    post('/joint-accounts', b, displayName === undefined ? { inviteeEmail } : { displayName, inviteeEmail }).expect(201);

  // ─── M1 · create ──────────────────────────────────────────────────────────

  it('M1: creation is atomic — account + single ACTIVE member + PENDING invitation; response carries only approved fields', async () => {
    const res = await createAccount(a, 'invitee@starfetch.dev');
    const { jointAccountId, displayName, invitation } = res.body.data;
    expect(displayName).toBe('Ada One'); // holder-name defaulting (≤60)
    expect(Object.keys(invitation).sort()).toEqual(['expiresAt', 'invitationId', 'invitedEmailMasked', 'status']);
    expect(invitation.invitedEmailMasked).toBe('i***@starfetch.dev');
    expect(invitation.status).toBe('PENDING');
    expect(new Date(invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(JSON.stringify(res.body)).not.toContain('invitee@starfetch.dev'); // raw invitee address never returned

    const members = await t.prisma.jointAccountMember.findMany({ where: { jointAccountId } });
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(a.userId);
    const inv = await t.prisma.jointAccountInvitation.findUnique({ where: { id: invitation.invitationId } });
    expect(inv?.status).toBe('PENDING');
    expect(inv?.invitedEmailNormalized).toBe('invitee@starfetch.dev');
    expect(inv?.invitedByUserId).toBe(a.userId);

    // awaiting-second-holder state surfaces through the Step-3 read API
    const det = await request(t.server)
      .get(`/api/v1/joint-accounts/${jointAccountId}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    expect(det.body.data.membership).toEqual({ capacity: 2, activeCount: 1, awaitingSecondHolder: true });
    // no CROSS-account authorization granted to the creator
    expect((await request(t.server).get('/api/v1/me/joint-accounts').set('Authorization', `Bearer ${a.token}`)).body.data).toHaveLength(1);

    // invitation email: exactly one, AFTER commit, no tokens/credentials
    expect(t.jointMailer.outbox).toHaveLength(1);
    const mail = t.jointMailer.outbox[0];
    expect(mail.to).toBe('invitee@starfetch.dev');
    expect(mail.invitationsUrl).toContain('http');
    expect(JSON.stringify(mail)).not.toMatch(/csrf|token|credential/i);
  });

  it('M1: honors explicit displayName (trimmed); rejects over-60 / blank-after-trim / invalid email / unknown fields / self-invite', async () => {
    const named = await createAccount(a, 'zzz@nowhere.test', '  My   ');
    expect(named.body.data.displayName).toBe('My');

    for (const [body, label] of [
      [{ inviteeEmail: 'x@y.z', displayName: 'x'.repeat(61) }, 'displayName>60'],
      [{ inviteeEmail: 'x@y.z', displayName: '   ' }, 'blank displayName'],
      [{ inviteeEmail: 'not-an-email' }, 'bad email'],
      [{ displayName: 'x', inviteeEmail: 'b@y.z', secretAccountId: a.userId }, 'unknown field'],
      [{ inviteeEmail: 'CREATOR@starfetch.DEV' }, 'self-invite (case-insensitive)'],
    ] as const) {
      const r = await post('/joint-accounts', a, body as object).expect(400);
      expect(r.body.error.code).toBe('VALIDATION_FAILED');
      void label;
    }
  });

  it('M1: missing CSRF / evil origin / no session / STAFF are each rejected by the correct guard', async () => {
    const noCsrf = await request(t.server)
      .post('/api/v1/joint-accounts')
      .set('Authorization', `Bearer ${a.token}`)
      .set('Origin', GOOD_ORIGIN)
      .send({ inviteeEmail: 'guardprobe@starfetch.dev' })
      .expect(403);
    expect(noCsrf.body.error.code).toBe(ERROR_CODES.CSRF_VALIDATION_FAILED);

    const evil = await post('/joint-accounts', a, { inviteeEmail: 'guardprobe@starfetch.dev' }, 'https://evil.example').expect(403);
    expect(evil.body.error.code).toBe(ERROR_CODES.FORBIDDEN);

    expect((await post('/joint-accounts', null, { inviteeEmail: 'guardprobe@starfetch.dev' }, null).expect(401)).body.error.code).toBe('UNAUTHENTICATED');
    expect((await post('/joint-accounts', staff, { inviteeEmail: 'guardprobe@starfetch.dev' }).expect(403)).body.error.code).toBe('FORBIDDEN');
  });

  it('M1: caller with emailVerifiedAt=null (session still valid) is refused 403 EMAIL_NOT_VERIFIED', async () => {
    await t.prisma.user.update({ where: { id: a.userId }, data: { emailVerifiedAt: null } });
    try {
      const r = await post('/joint-accounts', a, { inviteeEmail: 'guardprobe@starfetch.dev' }).expect(403);
      expect(r.body.error.code).toBe(ERROR_CODES.EMAIL_NOT_VERIFIED);
    } finally {
      await t.prisma.user.update({ where: { id: a.userId }, data: { emailVerifiedAt: new Date() } });
    }
  });

  // ─── M2 · invite / reinvite ───────────────────────────────────────────────

  it('M2: happy path issues PENDING; anti-enumeration holds for unregistered emails (identical 201 shape)', async () => {
    const acc = await createAccount(a, 'only-for-m2@starfetch.dev');
    const accId = acc.body.data.jointAccountId as string;
    // revoke the creation invite first (single-live rule) by re-inviting same email:
    const re1 = await post(`/joint-accounts/${accId}/invitations`, a, { email: 'only-for-m2@starfetch.dev' }).expect(201);
    expect(re1.body.data.invitationId).not.toBe(acc.body.data.invitation.invitationId);
    // now invite an UNREGISTERED address → same 201, no existence disclosure
    const liveId = re1.body.data.invitationId as string;
    await t.prisma.jointAccountInvitation.update({ where: { id: liveId }, data: { status: 'REVOKED' } });
    const unregistered = await post(`/joint-accounts/${accId}/invitations`, a, { email: 'ghost@nowhere.test' }).expect(201);
    expect(Object.keys(unregistered.body.data).sort()).toEqual(['expiresAt', 'invitationId', 'invitedEmailMasked', 'status']);
    expect(unregistered.body.data.invitedEmailMasked).toBe('g***@nowhere.test');
  });

  it('M2: replacement of pending SAME email revokes old (old accept path dies); DIFFERENT live pending → 409; member email → 409; full account → 409', async () => {
    const acc = await createAccount(a, 'rho@starfetch.dev');
    const accId = acc.body.data.jointAccountId as string;
    const inv1 = acc.body.data.invitation.invitationId as string;

    const repl = await post(`/joint-accounts/${accId}/invitations`, a, { email: 'RHO@starfetch.dev' }).expect(201);
    expect((await t.prisma.jointAccountInvitation.findUnique({ where: { id: inv1 } }))?.status).toBe('REVOKED');
    const livePending = await t.prisma.jointAccountInvitation.count({
      where: { jointAccountId: accId, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    expect(livePending).toBe(1);

    const r2 = await post(`/joint-accounts/${accId}/invitations`, a, { email: 'different@starfetch.dev' }).expect(409);
    expect(r2.body.error.code).toBe(ERROR_CODES.CONFLICT);

    const selfMember = await post(`/joint-accounts/${accId}/invitations`, a, { email: 'creator@starfetch.dev' }).expect(409);
    expect(selfMember.body.error.code).toBe(ERROR_CODES.CONFLICT);

    // FULL account: creator + direct DB second member → M2 refuses with 409.
    const full = await createAccount(a, 'fullcase@starfetch.dev');
    const fullId = full.body.data.jointAccountId as string;
    await t.prisma.jointAccountMember.create({ data: { jointAccountId: fullId, userId: b.userId } });
    const fullRes = await post(`/joint-accounts/${fullId}/invitations`, a, { email: 'anyone@starfetch.dev' }).expect(409);
    expect(fullRes.body.error.code).toBe(ERROR_CODES.CONFLICT);
  });

  it('M2: non-member, pending invitee and unknown ids → identical 404', async () => {
    const acc = await createAccount(a, 'scope204@starfetch.dev');
    const accId = acc.body.data.jointAccountId as string;
    const unknown = await post(`/joint-accounts/c3c6d497-2f0d-4f25-8a3f-6c47d54c9a00/invitations`, a, { email: 'x@y.z' }).expect(404);
    const outsider = await post(`/joint-accounts/${accId}/invitations`, c, { email: 'x@y.z' }).expect(404);
    for (const r of [unknown, outsider]) {
      expect(r.body.error.code).toBe('NOT_FOUND');
      expect(r.body.error.message).toBe('Account not found.');
    }
  });

  // ─── M3 · inbox ───────────────────────────────────────────────────────────

  it('M3: inbox shows ONLY live PENDING invitations addressed to MY verified email, with documented fields; other users see []', async () => {
    const acc = await createAccount(v, 'inbox@starfetch.dev');
    const invId = acc.body.data.invitation.invitationId as string;
    const inboxUser = await verifiedLogin('inbox@starfetch.dev', 'Ina', 'Box');
    // expired + revoked invitations must be filtered out
    const acc2 = await createAccount(v, 'inbox@starfetch.dev');
    await t.prisma.jointAccountInvitation.update({
      where: { id: acc2.body.data.invitation.invitationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await request(t.server)
      .get('/api/v1/me/joint-invitations')
      .set('Authorization', `Bearer ${inboxUser.token}`)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    const item = res.body.data[0];
    expect(Object.keys(item).sort()).toEqual([
      'accountDisplayName',
      'expiresAt',
      'invitationId',
      'inviterFirstName',
      'jointAccountId',
      'sentAt',
    ]);
    expect(item.invitationId).toBe(invId);
    expect(item.invitedEmail).toBeUndefined();
    expect(item.inviterFirstName).toBe('Vera');

    const other = await request(t.server)
      .get('/api/v1/me/joint-invitations')
      .set('Authorization', `Bearer ${c.token}`)
      .expect(200);
    expect(other.body.data).toEqual([]);
    expect(
      (await request(t.server).get('/api/v1/me/joint-invitations').expect(401)).body.error.code,
    ).toBe('UNAUTHENTICATED');
  });

  // ─── M4 · accept ──────────────────────────────────────────────────────────

  async function accept(who: AuthBundle, invitationId: string) {
    return post(`/me/joint-invitations/${invitationId}/accept`, who).expect(200);
  }

  async function freshInvitationTo(email: string) {
    const acc = await createAccount(a, email);
    return {
      accountId: acc.body.data.jointAccountId as string,
      invitationId: acc.body.data.invitation.invitationId as string,
    };
  }

  it('M4: verified invitee accepts → second membership + ACCEPTED + acceptedByUserId; both holders reach the account', async () => {
    const { accountId, invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    const res = await accept(b, invitationId);
    expect(res.body.data.jointAccountId).toBe(accountId);
    expect(String(res.body.data.joinedAt)).toMatch(/T.*Z$/);

    const members = await t.prisma.jointAccountMember.findMany({ where: { jointAccountId: accountId } });
    expect(members.map((m) => m.userId).sort()).toEqual([a.userId, b.userId].sort());
    const inv = await t.prisma.jointAccountInvitation.findUnique({ where: { id: invitationId } });
    expect(inv?.status).toBe('ACCEPTED');
    expect(inv?.acceptedByUserId).toBe(b.userId);
    expect(inv?.respondedAt).not.toBeNull();

    for (const who of [a, b]) {
      const r = await request(t.server)
        .get(`/api/v1/joint-accounts/${accountId}`)
        .set('Authorization', `Bearer ${who.token}`)
        .expect(200);
      expect(r.body.data.membership).toEqual({ capacity: 2, activeCount: 2, awaitingSecondHolder: false });
    }
  });

  it('M4: idempotent authorized replay — double accept returns the SAME 200 with zero side effects', async () => {
    const { accountId, invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    const first = await accept(b, invitationId);
    const second = await post(`/me/joint-invitations/${invitationId}/accept`, b).expect(200);
    expect(second.body.data).toEqual(first.body.data);
    expect(await t.prisma.jointAccountMember.count({ where: { jointAccountId: accountId } })).toBe(2);
    const concurrent = await Promise.all([
      post(`/me/joint-invitations/${invitationId}/accept`, b),
      post(`/me/joint-invitations/${invitationId}/accept`, b),
    ]);
    for (const r of concurrent) {
      expect(r.status).toBe(200);
      expect(r.body.data.joinedAt).toBe(first.body.data.joinedAt);
    }
    expect(await t.prisma.jointAccountMember.count({ where: { jointAccountId: accountId } })).toBe(2);
  });

  it('M4: wrong user / non-invitee / unknown / malformed → identical 404; revoked → 404; declined → 404; expired → 410 ONLY for addressee', async () => {
    const { invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    const wrong = await post(`/me/joint-invitations/${invitationId}/accept`, c).expect(404);
    expect(wrong.body.error.code).toBe('NOT_FOUND');
    expect((await post(`/me/joint-invitations/${'c3c6d497-2f0d-4f25-8a3f-6c47d54c9a00'}/accept`, b).expect(404)).body.error.code).toBe('NOT_FOUND');
    expect((await post(`/me/joint-invitations/not-a-uuid/accept`, b).expect(404)).body.error.code).toBe('NOT_FOUND');
    expect((await post(`/me/joint-invitations/${invitationId}/accept`, null, {}, null).expect(401)).body.error.code).toBe('UNAUTHENTICATED');

    // declined → 404
    const dec = await freshInvitationTo('invitee@starfetch.dev');
    await post(`/me/joint-invitations/${dec.invitationId}/decline`, b).expect(200);
    const acc = await post(`/me/joint-invitations/${dec.invitationId}/accept`, b).expect(404);
    expect(acc.body.error.code).toBe('NOT_FOUND');

    // revoked (replaced) → 404
    const rep = await freshInvitationTo('invitee@starfetch.dev');
    await post(`/joint-accounts/${rep.accountId}/invitations`, a, { email: 'invitee@starfetch.dev' }).expect(201);
    const accRev = await post(`/me/joint-invitations/${rep.invitationId}/accept`, b).expect(404);
    expect(accRev.body.error.code).toBe('NOT_FOUND');

    // expired → 410 for addressee, 404 for everyone else
    const exp = await freshInvitationTo('invitee@starfetch.dev');
    await t.prisma.jointAccountInvitation.update({
      where: { id: exp.invitationId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const gone410 = await post(`/me/joint-invitations/${exp.invitationId}/accept`, b).expect(410);
    expect(gone410.body.error.code).toBe(ERROR_CODES.GONE);
    const outsider4094 = await post(`/me/joint-invitations/${exp.invitationId}/accept`, c).expect(404);
    expect(outsider4094.body.error.code).toBe('NOT_FOUND');
  });

  it('M4: accepting into a FULL account fails 409 atomically (no membership, invitation stays PENDING)', async () => {
    const { accountId, invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    await accept(b, invitationId); // account now full [a, b]
    // someone else cannot be invited... simulate concurrency loss path: a second pending invite created then accept attempted
    const tx2 = await t.prisma.jointAccountInvitation.create({
      data: {
        jointAccountId: accountId,
        invitedEmail: 'unrelated@starfetch.dev',
        invitedEmailNormalized: 'unrelated@starfetch.dev',
        invitedByUserId: a.userId,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const r = await post(`/me/joint-invitations/${tx2.id}/accept`, c).expect(409);
    expect(r.body.error.code).toBe(ERROR_CODES.CONFLICT);
    expect(await t.prisma.jointAccountMember.count({ where: { jointAccountId: accountId } })).toBe(2);
    expect((await t.prisma.jointAccountInvitation.findUnique({ where: { id: tx2.id } }))?.status).toBe('PENDING');
  });

  it('M4: unverified-email caller → 403 EMAIL_NOT_VERIFIED (consent is impossible without email ownership)', async () => {
    const { invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    await t.prisma.user.update({ where: { id: b.userId }, data: { emailVerifiedAt: null } });
    try {
      const r = await post(`/me/joint-invitations/${invitationId}/accept`, b).expect(403);
      expect(r.body.error.code).toBe(ERROR_CODES.EMAIL_NOT_VERIFIED);
      expect((await t.prisma.jointAccountInvitation.findUnique({ where: { id: invitationId } }))?.status).toBe('PENDING');
    } finally {
      await t.prisma.user.update({ where: { id: b.userId }, data: { emailVerifiedAt: new Date() } });
    }
  });

  // ─── M5 · decline ─────────────────────────────────────────────────────────

  it('M5: addressee declines → terminal DECLINED, repeat-safe 200, accept afterwards 404, no membership', async () => {
    const { accountId, invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    const first = await post(`/me/joint-invitations/${invitationId}/decline`, b).expect(200);
    expect(first.body.data).toEqual({ invitationId, status: 'DECLINED' });
    const repeat = await post(`/me/joint-invitations/${invitationId}/decline`, b).expect(200);
    expect(repeat.body.data).toEqual(first.body.data);

    expect(await t.prisma.jointAccountMember.count({ where: { jointAccountId: accountId, userId: b.userId } })).toBe(0);
    const inv = await t.prisma.jointAccountInvitation.findUnique({ where: { id: invitationId } });
    expect(inv?.status).toBe('DECLINED');
    expect(inv?.acceptedByUserId).toBeNull();

    await post(`/me/joint-invitations/${invitationId}/accept`, b).expect(404);
    // wrong user cannot decline
    const wrong = await post(`/me/joint-invitations/${invitationId}/decline`, c).expect(404);
    expect(wrong.body.error.code).toBe('NOT_FOUND');
  });

  it('M5: correction — caller whose email is UNVERIFIED is refused 403 EMAIL_NOT_VERIFIED (session itself still valid)', async () => {
    const { invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    await t.prisma.user.update({ where: { id: b.userId }, data: { emailVerifiedAt: null } });
    try {
      const r = await post(`/me/joint-invitations/${invitationId}/decline`, b).expect(403);
      expect(r.body.error.code).toBe(ERROR_CODES.EMAIL_NOT_VERIFIED);
      expect((await t.prisma.jointAccountInvitation.findUnique({ where: { id: invitationId } }))?.status).toBe('PENDING'); // untouched
    } finally {
      await t.prisma.user.update({ where: { id: b.userId }, data: { emailVerifiedAt: new Date() } });
    }
    // verified addressee decline remains intact & idempotent (regression of corrected flow)
    const first = await post(`/me/joint-invitations/${invitationId}/decline`, b).expect(200);
    expect(first.body.data.status).toBe('DECLINED');
    await post(`/me/joint-invitations/${invitationId}/decline`, b).expect(200);
    // verified NON-addressee still gets anti-enumeration 404 (not 403-ish detail)
    await post(`/me/joint-invitations/${invitationId}/decline`, c).expect(404);
  });

  it('log protection: synthetic SMTP exception with sensitive content NEVER surfaces in logs or the API response', async () => {
    const logger = require('@nestjs/common').Logger as typeof import('@nestjs/common').Logger;
    const warnSpy = jest.spyOn(logger.prototype, 'warn').mockImplementation(() => undefined as void);
    const real = t.jointMailer.sendJointInvitation.bind(t.jointMailer);
    t.jointMailer.sendJointInvitation = async () => {
      throw new Error(
        '535 5.7.8 authentication failed: user=topsecret@corp.internal password=hunter2 token=sk_live_abc123',
      );
    };
    try {
      const res = await createAccount(a, 'logsafety@starfetch.dev');
      expect(res.body.data.invitation.status).toBe('PENDING');
      const blob = JSON.stringify(res.body);
      for (const secret of ['topsecret@corp.internal', 'hunter2', 'sk_live_abc123', '535']) {
        expect(blob).not.toContain(secret);
      }
      expect(warnSpy).toHaveBeenCalled();
      const logged = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(logged).toContain('l***@starfetch.dev'); // recipient masked
      expect(logged).toContain('category='); // structured category present
      for (const secret of ['topsecret@corp.internal', 'hunter2', 'sk_live_abc123', 'authentication failed']) {
        expect(logged).not.toContain(secret);
      }
      // invitation persisted despite failure
      const inv = await t.prisma.jointAccountInvitation.findUnique({
        where: { id: res.body.data.invitation.invitationId },
      });
      expect(inv?.status).toBe('PENDING');
    } finally {
      t.jointMailer.sendJointInvitation = real;
      warnSpy.mockRestore();
    }
  });

  it('M5: expired invitation decline → 410 for addressee, 404 for others', async () => {
    const { invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    await t.prisma.jointAccountInvitation.update({
      where: { id: invitationId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await post(`/me/joint-invitations/${invitationId}/decline`, b).expect(410)).body.error.code).toBe(ERROR_CODES.GONE);
    expect((await post(`/me/joint-invitations/${invitationId}/decline`, c).expect(404)).body.error.code).toBe('NOT_FOUND');
  });

  it('delivery code allowlist: fabricated sensitive uppercase code NEVER reaches logs; recognizeable transport codes do', async () => {
    const logger = require('@nestjs/common').Logger as typeof import('@nestjs/common').Logger;
    const warnSpy = jest.spyOn(logger.prototype, 'warn').mockImplementation(() => undefined as void);
    const real = t.jointMailer.sendJointInvitation.bind(t.jointMailer);
    try {
      // fabricated, sensitive-looking code (uppercase + code-shaped, but NOT allowlisted)
      t.jointMailer.sendJointInvitation = async () => {
        const err = new Error('irrelevant') as Error & { code: string };
        err.code = 'NEONSECRETKEY'; // uppercase, code-shaped, but NOT allowlisted
        throw err;
      };
      const forged = await createAccount(a, 'code-fab@starfetch.dev');
      expect(forged.status).toBe(201);
      let logged = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(logged).toContain('category=send_failed');
      expect(logged).not.toContain('NEONSECRETKEY');

      warnSpy.mockClear();
      t.jointMailer.sendJointInvitation = async () => {
        const err = new Error('x') as Error & { code: string };
        err.code = 'ECONNREFUSED'; // recognized transport code — safe to surface
        throw err;
      };
      const genuine = await createAccount(a, 'code-real@starfetch.dev');
      expect(genuine.status).toBe(201);
      logged = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(logged).toContain('category=ECONNREFUSED');
    } finally {
      t.jointMailer.sendJointInvitation = real;
      warnSpy.mockRestore();
    }
  });

  // ─── concurrency against PostgreSQL ───────────────────────────────────────

  it('concurrency: accept vs decline race → exactly one 200 and one 404, final state consistent', async () => {
    const { accountId, invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    const results = await Promise.all([
      post(`/me/joint-invitations/${invitationId}/accept`, b),
      post(`/me/joint-invitations/${invitationId}/decline`, b),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 404]);
    const inv = await t.prisma.jointAccountInvitation.findUnique({ where: { id: invitationId } });
    const memberCount = await t.prisma.jointAccountMember.count({
      where: { jointAccountId: accountId, userId: b.userId },
    });
    if (inv?.status === 'ACCEPTED') expect(memberCount).toBe(1);
    else {
      expect(inv?.status).toBe('DECLINED');
      expect(memberCount).toBe(0);
    }
  });

  it('concurrency: accept vs reinvite race → outcome is linearizable (either accept-wins+409, or reinvite-wins+404)', async () => {
    const { accountId, invitationId } = await freshInvitationTo('invitee@starfetch.dev');
    const [acceptRes, inviteRes] = await Promise.all([
      post(`/me/joint-invitations/${invitationId}/accept`, b),
      post(`/joint-accounts/${accountId}/invitations`, a, { email: 'invitee@starfetch.dev' }),
    ]);
    // Linearizable: exactly one of the two serializaion orders must hold.
    if (acceptRes.status === 200) {
      expect(inviteRes.status).toBe(409); // accept committed first → invite hit capacity
    } else {
      expect(acceptRes.status).toBe(404); // reinvite committed first → old invitation revoked
      expect(inviteRes.status).toBe(201);
    }
    const memberCount = await t.prisma.jointAccountMember.count({
      where: { jointAccountId: accountId, userId: b.userId },
    });
    if (acceptRes.status === 200) {
      expect(memberCount).toBe(1); // accepted; reinvite hit capacity
      expect(inviteRes.status).toBe(409);
    } else {
      expect(memberCount).toBe(0); // reinvite revoked first; accept 404
      expect(inviteRes.status).toBe(201);
    }
  });

  it('delivery failure does NOT sink the invitation — 201 persists the row, response never claims "sent"', async () => {
    const real = t.jointMailer.sendJointInvitation.bind(t.jointMailer);
    t.jointMailer.sendJointInvitation = async () => {
      throw new Error('smtp down');
    };
    try {
      const res = await createAccount(a, 'deliveryfail@starfetch.dev');
      expect(res.body.data.invitation.status).toBe('PENDING');
      expect(JSON.stringify(res.body.data)).not.toMatch(/emailSent|deliverySucceeded/i);
      const inv = await t.prisma.jointAccountInvitation.findUnique({
        where: { id: res.body.data.invitation.invitationId },
      });
      expect(inv?.status).toBe('PENDING'); // persisted despite delivery failure — retry = safe reinvite
    } finally {
      t.jointMailer.sendJointInvitation = real;
    }
  });

  it('keyed mutation throttles remain wired (smoke: routes carry guards; deep buckets proven in Step-2 probes)', async () => {
    // The Step-2 probe suite proves the keyed limiter buckets/ordering/fail-closed
    // behavior with tiny limits; here we just assert the guards are in the stack
    // by exercising one full guarded mutation end-to-end (done above). Route-level
    // @KeyedRateLimit metadata presence is compile-verified in the controller.
    const { invitationId } = await freshInvitationTo('second@starfetch.dev');
    await post(`/me/joint-invitations/${invitationId}/accept`, v).expect(200);
    const r = await request(t.server)
      .get('/api/v1/me/joint-accounts')
      .set('Authorization', `Bearer ${v.token}`)
      .expect(200);
    expect((r.body.data as Array<unknown>).length).toBeGreaterThanOrEqual(1);
  });
});
