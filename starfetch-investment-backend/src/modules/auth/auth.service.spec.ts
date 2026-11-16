import { UserRole } from '@prisma/client';
jest.mock('./services/password.service', () => ({ PasswordService: class PasswordService {} }));
import { AuthService } from './auth.service';

describe('AuthService applicant registration', () => {
  const user = {
    id: 'synthetic-user-id',
    email: 'applicant@example.invalid',
    normalizedEmail: 'applicant@example.invalid',
    role: UserRole.INVESTOR,
  } as any;
  const challenge = { challengeId: 'synthetic-verification-id' } as any;

  function service() {
    const tx = {
      user: { create: jest.fn().mockResolvedValue(user) },
      investorProfile: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)) };
    const verification = {
      createChallenge: jest.fn().mockResolvedValue(challenge),
      sendCode: jest.fn().mockResolvedValue(undefined),
    };
    const passwords = { hash: jest.fn().mockResolvedValue('synthetic-argon2-hash') };
    const instance = new AuthService(
      prisma as any,
      {} as any,
      passwords as any,
      verification as any,
      {} as any,
      {} as any,
    );
    return { instance, tx, prisma, verification, passwords };
  }

  it('creates a Corporate auth applicant without an InvestorProfile', async () => {
    const { instance, tx, verification } = service();
    const result = await instance.register({
      registrationType: 'CORPORATE',
      email: 'applicant@example.invalid',
      password: 'synthetic valid passphrase',
    });

    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: UserRole.INVESTOR }),
    }));
    expect(tx.investorProfile.create).not.toHaveBeenCalled();
    expect(verification.createChallenge).toHaveBeenCalledWith(tx, user.id);
    expect(verification.sendCode).toHaveBeenCalledWith(user.email, challenge);
    expect(result.data).toMatchObject({ emailVerified: false, nextAction: 'VERIFY_EMAIL' });
  });

  it('logs in a verified Corporate auth user without a profile and returns empty display names', async () => {
    const corporateUser = {
      ...user,
      emailVerifiedAt: new Date('2026-10-22T00:00:00.000Z'),
      investorProfile: null,
    };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(corporateUser) } };
    const passwords = { verifyOrEqualize: jest.fn().mockResolvedValue(true) };
    const sessions = { establish: jest.fn().mockResolvedValue({
      sessionId: 'synthetic-session-id', refreshToken: 'synthetic-refresh',
      csrfToken: 'synthetic-csrf', refreshMaxAgeSeconds: 3600,
    }) };
    const accessTokens = { sign: jest.fn().mockResolvedValue('synthetic-access-token'), ttlSeconds: 900 };
    const instance = new AuthService(
      prisma as any, {} as any, passwords as any, {} as any, sessions as any, accessTokens as any,
    );

    const result = await instance.login({ email: corporateUser.email, password: 'synthetic passphrase' });

    expect(passwords.verifyOrEqualize).toHaveBeenCalledWith(undefined, 'synthetic passphrase');
    expect(result.data.user).toMatchObject({
      id: corporateUser.id,
      role: UserRole.INVESTOR,
      emailVerified: true,
      firstName: '',
      lastName: '',
    });
    expect(result.data.accessToken).toBe('synthetic-access-token');
  });

  it('keeps the existing Individual profile flow when registrationType is omitted', async () => {
    const { instance, tx } = service();
    await instance.register({
      email: 'applicant@example.invalid',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      password: 'synthetic valid passphrase',
    });
    expect(tx.investorProfile.create).toHaveBeenCalledWith({
      data: { userId: user.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
  });
});
