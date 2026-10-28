import request from 'supertest';
import { randomUUID } from 'crypto';
import { EmailVerificationService } from '../src/modules/auth/services/email-verification.service';
import {
  TestApp,
  cleanDatabase,
  cookieJar,
  createTestApp,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from './utils/test-app';

const PASSWORD = 'a perfectly valid passphrase';

function registerUser(
  t: TestApp,
  email: string,
  overrides: Record<string, unknown> = {},
): request.Test {
  return request(t.server)
    .post('/api/v1/auth/register')
    .send({ firstName: 'Ada', lastName: 'Lovelace', email, password: PASSWORD, ...overrides });
}

describe('Phase 2B — authentication & identity (e2e, real PostgreSQL)', () => {
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

  // ── Registration ───────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('registers an investor atomically: user + profile + challenge, NO session/credentials', async () => {
      const res = await registerUser(t, 'ada@example.com').expect(201);

      expect(res.body.data.userId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.data.verificationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.data.email).toBe('a***@example.com');
      expect(res.body.data.emailVerified).toBe(false);
      expect(res.body.data.nextAction).toBe('VERIFY_EMAIL');
      // No credential issuance of any kind.
      expect(res.body.data.accessToken).toBeUndefined();
      expect(res.headers['set-cookie']).toBeUndefined();

      const user = await t.prisma.user.findUnique({
        where: { id: res.body.data.userId },
        include: { investorProfile: true, emailVerificationChallenges: true, authSessions: true },
      });
      expect(user?.email).toBe('ada@example.com');
      expect(user?.normalizedEmail).toBe('ada@example.com');
      expect(user?.role).toBe('INVESTOR');
      expect(user?.emailVerifiedAt).toBeNull();
      expect(user?.investorProfile?.firstName).toBe('Ada');
      expect(user?.investorProfile?.lastName).toBe('Lovelace');
      expect(user?.emailVerificationChallenges).toHaveLength(1);
      expect(user?.authSessions).toHaveLength(0); // registration creates NO session
    });

    it('stores only an Argon2id hash — never the plaintext password', async () => {
      const res = await registerUser(t, 'hash@example.com').expect(201);
      const user = await t.prisma.user.findUnique({ where: { id: res.body.data.userId } });
      expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user?.passwordHash).not.toContain(PASSWORD);
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
      expect(JSON.stringify(res.body)).not.toContain('$argon2id$');
    });

    it('stores only the code HMAC (never the 6-digit code) and never returns it', async () => {
      const res = await registerUser(t, 'code@example.com').expect(201);
      const code = t.mailer.latestFor('code@example.com')?.code;
      expect(code).toMatch(/^[0-9]{6}$/);
      expect(JSON.stringify(res.body)).not.toContain(code);

      const challenge = await t.prisma.emailVerificationChallenge.findUnique({
        where: { id: res.body.data.verificationId },
      });
      expect(challenge?.codeHmac).toMatch(/^[0-9a-f]{64}$/);
      expect(challenge?.codeHmac).not.toContain(code);
    });

    it('rejects duplicate accounts differing only by email casing (normalized uniqueness)', async () => {
      await registerUser(t, 'User@Example.com').expect(201);
      const dup = await registerUser(t, 'user@example.COM').expect(409);
      expect(dup.body.error.code).toBe('CONFLICT');
      expect(dup.body.error.message).not.toMatch(/verified|unverified|exists? at/i);
      expect(await t.prisma.user.count()).toBe(1);
    });

    it('rejects confirmPassword / phone as unknown fields (frontend-only concerns)', async () => {
      const res = await registerUser(t, 'extra@example.com', {
        confirmPassword: PASSWORD,
        phone: '+2348012345678',
      }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('enforces password length 15–128 and accepts symbol-free passphrases', async () => {
      const short = await registerUser(t, 'short@example.com', { password: 'too-short' }).expect(400);
      expect(short.body.error.code).toBe('VALIDATION_FAILED');

      const tooLong = await registerUser(t, 'long@example.com', { password: 'x'.repeat(129) }).expect(400);
      expect(tooLong.body.error.code).toBe('VALIDATION_FAILED');

      await registerUser(t, 'pass@example.com', { password: 'fifteenlettersx' }).expect(201);
    });
  });

  // ── Email verification ─────────────────────────────────────────────────────

  describe('POST /auth/email/verify + /auth/email/resend', () => {
    it('verifies with the correct code and marks the user verified atomically', async () => {
      const reg = await registerUser(t, 'verify-me@example.com').expect(201);
      const code = t.mailer.latestFor('verify-me@example.com')!.code;

      const res = await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: reg.body.data.verificationId, code })
        .expect(200);
      expect(res.body.data).toEqual({ emailVerified: true, nextAction: 'LOGIN' });

      const user = await t.prisma.user.findUnique({ where: { id: reg.body.data.userId } });
      const challenge = await t.prisma.emailVerificationChallenge.findUnique({
        where: { id: reg.body.data.verificationId },
      });
      expect(user?.emailVerifiedAt).not.toBeNull();
      expect(challenge?.consumedAt).not.toBeNull(); // single-use
    });

    it('rejects an incorrect code and counts the attempt', async () => {
      const reg = await registerUser(t, 'wrong@example.com').expect(201);
      const res = await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: reg.body.data.verificationId, code: '000000' })
        .expect(400);
      expect(res.body.error.code).toBe('EMAIL_VERIFICATION_INVALID');

      const challenge = await t.prisma.emailVerificationChallenge.findUnique({
        where: { id: reg.body.data.verificationId },
      });
      expect(challenge?.attemptCount).toBe(1);
    });

    it('enforces the 5-attempt cap then permanently rejects even the correct code', async () => {
      const reg = await registerUser(t, 'cap@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const correct = t.mailer.latestFor('cap@example.com')!.code;
      const wrong = correct === '000000' ? '000001' : '000000';

      for (let i = 0; i < 4; i += 1) {
        await request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code: wrong }).expect(400);
      }
      const fifth = await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: wrong })
        .expect(429);
      expect(fifth.body.error.code).toBe('EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED');

      // Even the correct code is dead now.
      const late = await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: correct })
        .expect(429);
      expect(late.body.error.code).toBe('EMAIL_VERIFICATION_ATTEMPTS_EXCEEDED');
    });

    it('rejects an expired code', async () => {
      const reg = await registerUser(t, 'expired@example.com').expect(201);
      await t.prisma.emailVerificationChallenge.update({
        where: { id: reg.body.data.verificationId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const code = t.mailer.latestFor('expired@example.com')!.code;
      const res = await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: reg.body.data.verificationId, code })
        .expect(400);
      expect(res.body.error.code).toBe('EMAIL_VERIFICATION_EXPIRED');
    });

    it('rejects replay of a consumed code', async () => {
      const reg = await registerUser(t, 'consumed@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const code = t.mailer.latestFor('consumed@example.com')!.code;
      await request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code }).expect(200);
      const replay = await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code })
        .expect(409);
      expect(replay.body.error.code).toBe('EMAIL_VERIFICATION_CONSUMED');
    });

    it('rejects an unknown verification id safely', async () => {
      const res = await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: randomUUID(), code: '123456' })
        .expect(404);
      expect(res.body.error.code).toBe('EMAIL_VERIFICATION_INVALID');
    });

    it('resend rotates the code, invalidates the previous one, keeps verificationId', async () => {
      const reg = await registerUser(t, 'rotate@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const oldCode = t.mailer.latestFor('rotate@example.com')!.code;

      // Skip the 60s wait legitimately by aging lastSentAt in the DB.
      await t.prisma.emailVerificationChallenge.update({
        where: { id },
        data: { lastSentAt: new Date(Date.now() - 61_000) },
      });

      const res = await request(t.server)
        .post('/api/v1/auth/email/resend')
        .send({ verificationId: id })
        .expect(200);
      expect(res.body.data.verificationId).toBe(id);
      expect(res.body.data.email).toBe('r***@example.com');
      expect(res.body.data.expiresInSeconds).toBe(600);

      const newCode = t.mailer.latestFor('rotate@example.com')!.code;
      expect(newCode).not.toBe(oldCode);
      // No raw code is ever present in the API response.
      expect(JSON.stringify(res.body)).not.toContain(oldCode);
      expect(JSON.stringify(res.body)).not.toContain(newCode);

      // Previous code invalidated; new code works.
      await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: oldCode })
        .expect(400);
      await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: newCode })
        .expect(200);
    });

    it('enforces the 60-second resend cooldown', async () => {
      const reg = await registerUser(t, 'cool@example.com').expect(201);
      const res = await request(t.server)
        .post('/api/v1/auth/email/resend')
        .send({ verificationId: reg.body.data.verificationId })
        .expect(429);
      expect(res.body.error.code).toBe('RESEND_COOLDOWN');
      expect(res.body.error.context.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('enforces the 5-resends-per-hour limit', async () => {
      const reg = await registerUser(t, 'limit@example.com').expect(201);
      await t.prisma.emailVerificationChallenge.update({
        where: { id: reg.body.data.verificationId },
        data: {
          resendCount: 5,
          resendWindowStartedAt: new Date(),
          lastSentAt: new Date(Date.now() - 61_000),
        },
      });
      const res = await request(t.server)
        .post('/api/v1/auth/email/resend')
        .send({ verificationId: reg.body.data.verificationId })
        .expect(429);
      expect(res.body.error.code).toBe('RESEND_LIMIT_EXCEEDED');
    });

    it('refuses resend once the email is verified', async () => {
      const reg = await registerUser(t, 'done@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const code = t.mailer.latestFor('done@example.com')!.code;
      await request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code }).expect(200);

      const res = await request(t.server)
        .post('/api/v1/auth/email/resend')
        .send({ verificationId: id })
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  async function verifiedLogin(email: string): Promise<request.Response> {
    const reg = await registerUser(t, email);
    const id = reg.body.data.verificationId as string;
    const code = t.mailer.latestFor(email)!.code;
    await request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code }).expect(200);
    return request(t.server).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  }

  describe('POST /auth/login', () => {
    it('success: issues access JWT + user payload + HttpOnly refresh cookie + readable CSRF cookie', async () => {
      const res = await verifiedLogin('login@example.com');
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(res.body.data.expiresInSeconds).toBe(900);
      expect(res.body.data.user).toEqual({
        id: expect.any(String),
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'login@example.com',
        emailVerified: true,
        role: 'INVESTOR',
      });

      const jar = cookieJar(res);
      const refresh = jar.get(REFRESH_COOKIE);
      const csrf = jar.get(CSRF_COOKIE);
      expect(refresh?.value.length).toBeGreaterThan(40);
      expect(refresh?.flags).toMatch(/HttpOnly/i);
      expect(refresh?.flags).toMatch(/SameSite=Lax/i);
      expect(refresh?.flags).toMatch(/Path=\//i);
      expect(refresh?.flags).not.toMatch(/Secure/i); // development mode
      expect(csrf).toBeDefined();
      expect(csrf?.flags).not.toMatch(/HttpOnly/i);
      expect(csrf?.value.split('.')).toHaveLength(3);

      // Refresh credential NEVER appears in the JSON body.
      expect(JSON.stringify(res.body)).not.toContain(refresh!.value);
      expect(JSON.stringify(res.body)).not.toContain(csrf!.value);

      // Server-side AuthSession + RefreshToken rows exist; only the hash is stored.
      const session = await t.prisma.authSession.findFirst({
        where: { user: { normalizedEmail: 'login@example.com' } },
      });
      expect(session).not.toBeNull();
      const token = await t.prisma.refreshToken.findFirst({ where: { sessionId: session!.id } });
      expect(token?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(token?.tokenHash).not.toBe(refresh!.value);
    });

    it('unknown email and wrong password produce the IDENTICAL public error', async () => {
      await verifiedLogin('same@example.com');

      const unknown = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: PASSWORD })
        .expect(401);
      const wrongPw = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'same@example.com', password: 'totally wrong passphrase 9' })
        .expect(401);

      const scrub = (b: object) => {
        const copy = JSON.parse(JSON.stringify(b)) as { error: { requestId?: string } };
        delete copy.error.requestId;
        return copy;
      };
      expect(scrub(unknown.body)).toEqual(scrub(wrongPw.body));
      expect(unknown.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(unknown.body.error.message).toBe('We could not sign you in with those details.');
      expect(unknown.body.error.message).not.toMatch(/not found|password|exist/i);
    });

    it('unverified email → 403 EMAIL_NOT_VERIFIED with safe context, and no session', async () => {
      await registerUser(t, 'pending@example.com').expect(201);
      const res = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'pending@example.com', password: PASSWORD })
        .expect(403);
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
      expect(res.body.error.context.verificationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.error.context.email).toBe('p***@example.com');
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(await t.prisma.authSession.count()).toBe(0);
    });

    it('accepts case-insensitive email lookup (normalized), preserving display casing', async () => {
      const reg = await registerUser(t, 'Case@Example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const code = t.mailer.latestFor('Case@Example.com')!.code;
      await request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code }).expect(200);

      const res = await request(t.server)
        .post('/api/v1/auth/login')
        .send({ email: 'case@EXAMPLE.COM', password: PASSWORD })
        .expect(200);
      expect(res.body.data.user.email).toBe('Case@Example.com'); // display form preserved
    });
  });

  // ── Protected /me ──────────────────────────────────────────────────────────

  describe('GET /me (guard)', () => {
    it('401 without token / with invalid token / with expired token', async () => {
      const noToken = await request(t.server).get('/api/v1/me').expect(401);
      expect(noToken.body.error.code).toBe('UNAUTHENTICATED');

      const bogus = await request(t.server)
        .get('/api/v1/me')
        .set('Authorization', 'Bearer not-a-token')
        .expect(401);
      expect(bogus.body.error.code).toBe('UNAUTHENTICATED');

      // Expired: sign a token with exp in the past using the test env secret.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jsonwebtoken = require('jsonwebtoken');
      const expired = jsonwebtoken.sign(
        { sub: randomUUID(), role: 'INVESTOR', sid: randomUUID() },
        process.env.JWT_ACCESS_SECRET,
        { algorithm: 'HS256', expiresIn: -10 },
      );
      const stale = await request(t.server)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
      expect(stale.body.error.code).toBe('UNAUTHENTICATED');
      expect(JSON.stringify(stale.body)).not.toMatch(/stack|secret/i);
    });

    it('200 with valid token returns the safe user projection only', async () => {
      const login = await verifiedLogin('me@example.com');
      const access = login.body.data.accessToken as string;

      const res = await request(t.server)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${access}`)
        .expect(200);
      expect(res.body.data).toEqual({
        id: expect.any(String),
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'me@example.com',
        emailVerified: true,
        role: 'INVESTOR',
      });
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.normalizedEmail).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/argon2|tokenHash|codeHmac/i);
    });
  });

  // ── Refresh / rotation / reuse ─────────────────────────────────────────────

  interface SessionCookies { refresh: string; csrf: string; }

  async function loginCookies(email: string): Promise<SessionCookies> {
    const login = await verifiedLogin(email);
    const jar = cookieJar(login);
    return { refresh: jar.get(REFRESH_COOKIE)!.value, csrf: jar.get(CSRF_COOKIE)!.value };
  }

  function refreshCall(cookies: SessionCookies, csrfHeader?: string, origin?: string) {
    let call = request(t.server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${cookies.refresh}; ${CSRF_COOKIE}=${cookies.csrf}`);
    if (csrfHeader !== undefined) call = call.set('X-CSRF-Token', csrfHeader);
    if (origin !== undefined) call = call.set('Origin', origin);
    return call;
  }

  describe('POST /auth/refresh', () => {
    it('rotates the credential, returns a new access token, extends the session', async () => {
      const cookies = await loginCookies('rot@example.com');
      const res = await refreshCall(cookies, cookies.csrf, 'http://localhost:3000').expect(200);
      expect(res.body.data.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(res.body.data.expiresInSeconds).toBe(900);

      const jar = cookieJar(res);
      const newRefresh = jar.get(REFRESH_COOKIE)!.value;
      const newCsrf = jar.get(CSRF_COOKIE)!.value;
      expect(newRefresh).not.toBe(cookies.refresh);
      expect(newCsrf).not.toBe(cookies.csrf);
      expect(JSON.stringify(res.body)).not.toContain(newRefresh);

      // Chain is recorded server-side.
      const oldToken = await t.prisma.refreshToken.findFirst({
        where: { session: { user: { normalizedEmail: 'rot@example.com' } }, usedAt: { not: null } },
      });
      expect(oldToken?.replacedByTokenId).not.toBeNull();
    });

    it('replay of a rotated credential revokes the ENTIRE session (reuse detection)', async () => {
      const cookies = await loginCookies('reuse@example.com');
      const rotated = await refreshCall(cookies, cookies.csrf, 'http://localhost:3000').expect(200);
      const rotatedJar = cookieJar(rotated);
      const fresh: SessionCookies = {
        refresh: rotatedJar.get(REFRESH_COOKIE)!.value,
        csrf: rotatedJar.get(CSRF_COOKIE)!.value,
      };

      // Attacker replays the OLD credential.
      await refreshCall(cookies, cookies.csrf, 'http://localhost:3000').expect(401);

      const session = await t.prisma.authSession.findFirst({
        where: { user: { normalizedEmail: 'reuse@example.com' } },
      });
      expect(session?.revokedAt).not.toBeNull();
      expect(session?.revokeReason).toBe('REFRESH_REUSE_DETECTED');

      // The legitimate owner's NEW credential is also dead now.
      await refreshCall(fresh, fresh.csrf, 'http://localhost:3000').expect(401);
    });

    it('rejects missing or mismatched CSRF header (signed double-submit)', async () => {
      const cookies = await loginCookies('csrf@example.com');
      const missing = await refreshCall(cookies, undefined, 'http://localhost:3000').expect(403);
      expect(missing.body.error.code).toBe('CSRF_VALIDATION_FAILED');
      const wrong = await refreshCall(cookies, 'csrf.csrf.invalid', 'http://localhost:3000').expect(403);
      expect(wrong.body.error.code).toBe('CSRF_VALIDATION_FAILED');
      // Same pair still works afterwards (nothing was consumed).
      await refreshCall(cookies, cookies.csrf, 'http://localhost:3000').expect(200);
    });

    it('rejects an untrusted browser Origin', async () => {
      const cookies = await loginCookies('origin@example.com');
      const res = await refreshCall(cookies, cookies.csrf, 'https://evil.example').expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects an expired session and records the revocation reason', async () => {
      const cookies = await loginCookies('abs@example.com');
      await t.prisma.authSession.updateMany({
        where: { user: { normalizedEmail: 'abs@example.com' } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await refreshCall(cookies, cookies.csrf, 'http://localhost:3000').expect(401);
      const session = await t.prisma.authSession.findFirst({
        where: { user: { normalizedEmail: 'abs@example.com' } },
      });
      expect(session?.revokeReason).toBe('SESSION_EXPIRED');
    });

    it('rejects an idled-out session', async () => {
      const cookies = await loginCookies('idle@example.com');
      await t.prisma.authSession.updateMany({
        where: { user: { normalizedEmail: 'idle@example.com' } },
        data: { idleExpiresAt: new Date(Date.now() - 1000) },
      });
      await refreshCall(cookies, cookies.csrf, 'http://localhost:3000').expect(401);
      const session = await t.prisma.authSession.findFirst({
        where: { user: { normalizedEmail: 'idle@example.com' } },
      });
      expect(session?.revokeReason).toBe('IDLE_EXPIRED');
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('revokes the session, clears both cookies, makes refresh unusable', async () => {
      const cookies = await loginCookies('out@example.com');
      const res = await request(t.server)
        .post('/api/v1/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE}=${cookies.refresh}; ${CSRF_COOKIE}=${cookies.csrf}`)
        .set('X-CSRF-Token', cookies.csrf)
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      expect(res.body.data.loggedOut).toBe(true);

      const jar = cookieJar(res);
      expect(jar.get(REFRESH_COOKIE)?.value).toBe('');
      expect(jar.get(CSRF_COOKIE)?.value).toBe('');

      const session = await t.prisma.authSession.findFirst({
        where: { user: { normalizedEmail: 'out@example.com' } },
      });
      expect(session?.revokeReason).toBe('USER_LOGOUT');

      // Refresh after logout is rejected.
      await refreshCall(cookies, cookies.csrf, 'http://localhost:3000').expect(401);
    });

    it('requires the CSRF pair and is idempotent when already logged out', async () => {
      const cookies = await loginCookies('idem@example.com');

      const noCsrf = await request(t.server)
        .post('/api/v1/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE}=${cookies.refresh}; ${CSRF_COOKIE}=${cookies.csrf}`)
        .set('Origin', 'http://localhost:3000')
        .expect(403);
      expect(noCsrf.body.error.code).toBe('CSRF_VALIDATION_FAILED');

      await request(t.server)
        .post('/api/v1/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE}=${cookies.refresh}; ${CSRF_COOKIE}=${cookies.csrf}`)
        .set('X-CSRF-Token', cookies.csrf)
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      // Repeated logout (already revoked / cookies gone) → safe idempotent 200.
      await request(t.server)
        .post('/api/v1/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE}=${cookies.refresh}; ${CSRF_COOKIE}=${cookies.csrf}`)
        .set('X-CSRF-Token', cookies.csrf)
        .set('Origin', 'http://localhost:3000')
        .expect(200);
      await request(t.server).post('/api/v1/auth/logout').expect(200);
    });
  });

  // ── Concurrency hardening (real parallel requests) ─────────────────────────

  describe('Concurrency hardening', () => {
    it('two concurrent refresh attempts with the SAME credential: exactly one wins; loser triggers reuse revocation', async () => {
      const cookies = await loginCookies('race-refresh@example.com');

      const [a, b] = await Promise.all([
        refreshCall(cookies, cookies.csrf, 'http://localhost:3000'),
        refreshCall(cookies, cookies.csrf, 'http://localhost:3000'),
      ]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 401]);

      const session = await t.prisma.authSession.findFirst({
        where: { user: { normalizedEmail: 'race-refresh@example.com' } },
      });
      expect(session?.revokedAt).not.toBeNull();
      expect(session?.revokeReason).toBe('REFRESH_REUSE_DETECTED');

      // Exactly one credential was consumed (no two valid descendants).
      const consumed = await t.prisma.refreshToken.count({
        where: { sessionId: session!.id, usedAt: { not: null } },
      });
      expect(consumed).toBe(1);

      // Every credential of the revoked session is dead — including the winner's descendant.
      const winner = a.status === 200 ? a : b;
      const wJar = cookieJar(winner);
      const descendant: SessionCookies = {
        refresh: wJar.get(REFRESH_COOKIE)!.value,
        csrf: wJar.get(CSRF_COOKIE)!.value,
      };
      await refreshCall(descendant, descendant.csrf, 'http://localhost:3000').expect(401);
    });

    it('two concurrent CORRECT verifications: exactly one consumes, second gets the safe conflict', async () => {
      const reg = await registerUser(t, 'race-verify@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const code = t.mailer.latestFor('race-verify@example.com')!.code;

      const [a, b] = await Promise.all([
        request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code }),
        request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code }),
      ]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 409]);
      const loser = a.status === 409 ? a : b;
      expect(loser.body.error.code).toBe('EMAIL_VERIFICATION_CONSUMED');

      const user = await t.prisma.user.findUnique({ where: { id: reg.body.data.userId } });
      expect(user?.emailVerifiedAt).not.toBeNull();
    });

    it('concurrent INCORRECT verifications increment attempts atomically — no lost updates', async () => {
      const reg = await registerUser(t, 'race-wrong@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const correct = t.mailer.latestFor('race-wrong@example.com')!.code;
      const wrong = correct === '000000' ? '000001' : '000000';

      const results = await Promise.all(
        [0, 1, 2].map(() =>
          request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code: wrong }),
        ),
      );
      for (const r of results) expect(r.status).toBe(400);

      const challenge = await t.prisma.emailVerificationChallenge.findUnique({ where: { id } });
      expect(challenge?.attemptCount).toBe(3); // exactly 3 — no lost increments

      // Cap not hit: the correct code still verifies.
      await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: correct })
        .expect(200);
    });

    it('two concurrent resends cannot both bypass the cooldown or leave two valid codes', async () => {
      const reg = await registerUser(t, 'race-resend@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const originalCode = t.mailer.latestFor('race-resend@example.com')!.code;

      await t.prisma.emailVerificationChallenge.update({
        where: { id },
        data: { lastSentAt: new Date(Date.now() - 61_000) },
      });

      const [a, b] = await Promise.all([
        request(t.server).post('/api/v1/auth/email/resend').send({ verificationId: id }),
        request(t.server).post('/api/v1/auth/email/resend').send({ verificationId: id }),
      ]);
      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 429]);

      // Exactly ONE new code was issued (original mail + one resend mail).
      const mails = t.mailer.outbox.filter((m) => m.to === 'race-resend@example.com');
      expect(mails).toHaveLength(2);
      const challenge = await t.prisma.emailVerificationChallenge.findUnique({ where: { id } });
      expect(challenge?.resendCount).toBe(1);

      // Previous code dead; the single rotated code valid.
      const rotated = t.mailer.latestFor('race-resend@example.com')!.code;
      await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: originalCode })
        .expect(400);
      await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: rotated })
        .expect(200);
    });

    it('attempt-cap race: a fifth incorrect attempt committed first MUST block a later correct-code consume', async () => {
      const reg = await registerUser(t, 'cap-race@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const correct = t.mailer.latestFor('cap-race@example.com')!.code;
      const wrong = correct === '000000' ? '000001' : '000000';

      // Drive deterministically to attemptCount = 4 (one below the cap).
      for (let i = 0; i < 4; i += 1) {
        await request(t.server)
          .post('/api/v1/auth/email/verify')
          .send({ verificationId: id, code: wrong })
          .expect(400);
      }
      const atFour = await t.prisma.emailVerificationChallenge.findUnique({ where: { id } });
      expect(atFour?.attemptCount).toBe(4);

      // Concurrent: correct code vs the fifth wrong attempt.
      const [correctRes, wrongRes] = await Promise.all([
        request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code: correct }),
        request(t.server).post('/api/v1/auth/email/verify').send({ verificationId: id, code: wrong }),
      ]);

      const user = await t.prisma.user.findUnique({ where: { id: reg.body.data.userId } });
      const challenge = await t.prisma.emailVerificationChallenge.findUnique({ where: { id } });
      expect(wrongRes.status).not.toBe(200);

      // FORBIDDEN OUTCOME: the cap committed first AND the correct code verifies afterward.
      if (challenge!.attemptCount >= 5 && challenge!.consumedAt === null) {
        expect(user!.emailVerifiedAt).toBeNull();
        expect(correctRes.status).not.toBe(200);
      }

      // Allowed outcome A — correct code consumed first: the concurrent wrong
      // request could not increment the consumed challenge (attempts stay at 4).
      if (correctRes.status === 200) {
        expect(user!.emailVerifiedAt).not.toBeNull();
        expect(challenge!.consumedAt).not.toBeNull();
        expect(challenge!.attemptCount).toBe(4);
      }

      // Internal consistency in every allowed ordering.
      expect(Boolean(challenge!.consumedAt)).toBe(Boolean(user!.emailVerifiedAt));
      expect(challenge!.attemptCount).toBeLessThanOrEqual(5);
    });

    it('resend-generation binding: an in-flight attempt from the OLD code generation never increments the NEW code', async () => {
      const reg = await registerUser(t, 'gen-race@example.com').expect(201);
      const id = reg.body.data.verificationId as string;
      const oldCode = t.mailer.latestFor('gen-race@example.com')!.code;
      const wrongCode = oldCode === '111111' ? '222222' : '111111';

      const verification = t.app.get(EmailVerificationService);

      // Simulate a request that READ the challenge at generation 1, then had a
      // resend rotate the code before its atomic increment executed.
      let intercepted = false;
      const delegate = t.prisma.emailVerificationChallenge.findUnique.bind(
        t.prisma.emailVerificationChallenge,
      );
      const spy = jest
        .spyOn(t.prisma.emailVerificationChallenge, 'findUnique')
        .mockImplementation((async (args: { where?: { id?: string } } & Record<string, unknown>) => {
          const result = await delegate(args);
          if (!intercepted && args?.where?.id === id) {
            intercepted = true;
            // Rotation happens while the verify request is in flight.
            await t.prisma.emailVerificationChallenge.update({
              where: { id },
              data: { lastSentAt: new Date(Date.now() - 61_000) },
            });
            await verification.resend(id);
          }
          return result;
        }) as never);

      await expect(verification.verify(id, wrongCode)).rejects.toMatchObject({
        response: { code: 'EMAIL_VERIFICATION_INVALID' },
      });
      spy.mockRestore();

      const fresh = await t.prisma.emailVerificationChallenge.findUnique({ where: { id } });
      expect(fresh?.resendCount).toBe(1);
      expect(fresh?.attemptCount).toBe(0); // new code generation untouched by the stale attempt
      expect(fresh?.consumedAt).toBeNull();

      // The rotated (current) code still verifies normally.
      const rotatedCode = t.mailer.latestFor('gen-race@example.com')!.code;
      expect(rotatedCode).not.toBe(oldCode);
      await request(t.server)
        .post('/api/v1/auth/email/verify')
        .send({ verificationId: id, code: rotatedCode })
        .expect(200);
    });
  });

  // ── Session revocation kills access tokens immediately ─────────────────────

  describe('Session-aware access tokens', () => {
    it('LOGOUT invalidates the same access token on /me immediately', async () => {
      const login = await verifiedLogin('inv-logout@example.com');
      const access = login.body.data.accessToken as string;
      const jar = cookieJar(login);
      const cookies: SessionCookies = {
        refresh: jar.get(REFRESH_COOKIE)!.value,
        csrf: jar.get(CSRF_COOKIE)!.value,
      };

      await request(t.server).get('/api/v1/me').set('Authorization', `Bearer ${access}`).expect(200);

      await request(t.server)
        .post('/api/v1/auth/logout')
        .set('Cookie', `${REFRESH_COOKIE}=${cookies.refresh}; ${CSRF_COOKIE}=${cookies.csrf}`)
        .set('X-CSRF-Token', cookies.csrf)
        .expect(200);

      const after = await request(t.server)
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${access}`)
        .expect(401);
      expect(after.body.error.code).toBe('UNAUTHENTICATED');
      expect(after.body.error.message).toBe('Authentication required.'); // no session details leak
    });

    it('REUSE DETECTION invalidates previously issued access tokens (v1 and v2) immediately', async () => {
      const login = await verifiedLogin('inv-reuse@example.com');
      const accessV1 = login.body.data.accessToken as string;
      const jar = cookieJar(login);
      const v1: SessionCookies = {
        refresh: jar.get(REFRESH_COOKIE)!.value,
        csrf: jar.get(CSRF_COOKIE)!.value,
      };

      await request(t.server).get('/api/v1/me').set('Authorization', `Bearer ${accessV1}`).expect(200);

      const rotated = await refreshCall(v1, v1.csrf, 'http://localhost:3000').expect(200);
      const accessV2 = rotated.body.data.accessToken as string;

      // Attacker replays the rotated-out credential → session revoked.
      await refreshCall(v1, v1.csrf, 'http://localhost:3000').expect(401);

      for (const token of [accessV1, accessV2]) {
        const res = await request(t.server).get('/api/v1/me').set('Authorization', `Bearer ${token}`).expect(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      }
    });
  });

  // ── Phase 2A contract preserved under the new module graph ─────────────────

  describe('foundation regression', () => {
    it('health + error envelope + request IDs still behave', async () => {
      const health = await request(t.server).get('/api/v1/health').expect(200);
      expect(health.body.data.status).toBe('ok');
      expect(health.body.meta.requestId).toBeDefined();

      const root = await request(t.server).get('/').expect(404);
      expect(root.body.error.requestId).not.toBe('unavailable');
      expect(root.headers['x-request-id']).toBe(root.body.error.requestId);
    });
  });
});
