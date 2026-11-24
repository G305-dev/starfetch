import { PrimaryAccountType, UserRole } from '@prisma/client';
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
      corporateApplicantProfile: { create: jest.fn().mockResolvedValue({}) },
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
      companyName: 'Example Holdings Limited',
      companyPhoneNumber: '+2348000000000',
      email: 'applicant@example.invalid',
      password: 'synthetic valid passphrase',
    });

    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ role: UserRole.INVESTOR, primaryAccountType: PrimaryAccountType.CORPORATE }),
    }));
    expect(tx.investorProfile.create).not.toHaveBeenCalled();
    expect(tx.corporateApplicantProfile.create).toHaveBeenCalledWith({ data: { userId: user.id, companyName: 'Example Holdings Limited', companyPhoneNumber: '+2348000000000' } });
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
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ primaryAccountType: PrimaryAccountType.INDIVIDUAL }),
    }));
    expect(tx.investorProfile.create).toHaveBeenCalledWith({
      data: { userId: user.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
  });
});


describe('AuthService authorized account contexts', () => {
  const auth = new AuthService(
    {} as any, {} as any, {} as any,
    {} as any, {} as any, {} as any,
  );

  const baseUser = {
    id: 'test-user',
    email: 'test@example.invalid',
    role: UserRole.INVESTOR,
    emailVerifiedAt: new Date(),
    primaryAccountType: null,
    investorProfile: null,
    corporateApplicantProfile: null,
    initiatedOnboardingApplications: [],
    jointMemberships: [],
  };

  const individual = {
    firstName: 'Test',
    lastName: 'Investor',
  };

  const corporate = {
    companyName: 'Test Company',
    companyPhoneNumber: '+2348000000000',
  };

  const cases = [
    ['Individual', {
      primaryAccountType: PrimaryAccountType.INDIVIDUAL,
      investorProfile: individual,
    }, ['INDIVIDUAL']],

    ['Individual with Joint membership', {
      primaryAccountType: PrimaryAccountType.INDIVIDUAL,
      investorProfile: individual,
      jointMemberships: [{ id: 'joint-1' }],
    }, ['INDIVIDUAL', 'JOINT']],

    ['Corporate applicant', {
      primaryAccountType: PrimaryAccountType.CORPORATE,
      corporateApplicantProfile: corporate,
    }, ['CORPORATE']],

    ['Corporate with old Individual profile and Joint membership', {
      primaryAccountType: PrimaryAccountType.CORPORATE,
      investorProfile: individual,
      jointMemberships: [{ id: 'joint-1' }],
    }, ['CORPORATE']],

    ['Individual with old Corporate evidence', {
      primaryAccountType: PrimaryAccountType.INDIVIDUAL,
      investorProfile: individual,
      corporateApplicantProfile: corporate,
      initiatedOnboardingApplications: [{ id: 'application-1' }],
    }, ['INDIVIDUAL']],

    ['Legacy Individual', {
      investorProfile: individual,
    }, ['INDIVIDUAL']],

    ['Legacy Corporate applicant', {
      corporateApplicantProfile: corporate,
    }, ['CORPORATE']],

    ['Legacy Corporate application owner', {
      initiatedOnboardingApplications: [{ id: 'application-1' }],
    }, ['CORPORATE']],

    ['Legacy account with both valid profiles', {
      investorProfile: individual,
      corporateApplicantProfile: corporate,
    }, ['INDIVIDUAL', 'CORPORATE']],

    ['Individual without profile', {
      primaryAccountType: PrimaryAccountType.INDIVIDUAL,
    }, []],

    ['Joint membership without Individual profile', {
      jointMemberships: [{ id: 'joint-1' }],
    }, []],

    ['Unverified Corporate applicant', {
      primaryAccountType: PrimaryAccountType.CORPORATE,
      emailVerifiedAt: null,
    }, []],

    ['Unclassified account without evidence', {}, []],

    ['Non-investor account', {
      role: UserRole.ADMIN,
      investorProfile: individual,
      corporateApplicantProfile: corporate,
    }, []],
  ] as const;

  it.each(cases)('%s returns the correct contexts', (_name, overrides, expected) => {
    const result = auth.safeUser({
      ...baseUser,
      ...overrides,
    } as any);

    expect(result.authorizedContexts).toEqual(expected);
  });
});
