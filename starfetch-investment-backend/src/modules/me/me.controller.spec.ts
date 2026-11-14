import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { KycCompletionService } from './kyc-completion.service';
import { MeController } from './me.controller';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';
const principal = {
  userId: USER_ID,
  role: UserRole.INVESTOR,
  sessionId: '22222222-2222-4222-8222-222222222222',
};

describe('MeController GET /api/v1/me KYC projection', () => {
  it('preserves the safe user fields and adds only the two public completion values', async () => {
    const user = {
      id: USER_ID,
      email: 'corporate.applicant@example.invalid',
      normalizedEmail: 'corporate.applicant@example.invalid',
      passwordHash: 'not-for-response',
      role: UserRole.INVESTOR,
      emailVerifiedAt: new Date('2026-11-13T12:00:00.000Z'),
      investorProfile: null,
    };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
    const auth = {
      safeUser: jest.fn(() => ({
        id: USER_ID,
        firstName: '',
        lastName: '',
        email: 'corporate.applicant@example.invalid',
        emailVerified: true,
        role: UserRole.INVESTOR,
      })),
    };
    const kycCompletion = {
      forPrincipal: jest.fn().mockResolvedValue({ individual: 'REQUIRED', corporate: 'REQUIRED' }),
    };
    const controller = new MeController(
      prisma as unknown as PrismaService,
      auth as unknown as AuthService,
      kycCompletion as unknown as KycCompletionService,
    );
    const req = {
      principal,
      query: { userId: OTHER_USER_ID }, // ignored; ownership is the authenticated principal only
    } as unknown as AuthenticatedRequest;

    const result = await controller.me(req);
    expect(result).toEqual({
      data: {
        id: USER_ID,
        firstName: '',
        lastName: '',
        email: 'corporate.applicant@example.invalid',
        emailVerified: true,
        role: UserRole.INVESTOR,
        kycCompletion: { individual: 'REQUIRED', corporate: 'REQUIRED' },
      },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      include: { investorProfile: true },
    });
    expect(kycCompletion.forPrincipal).toHaveBeenCalledWith(principal, {
      role: UserRole.INVESTOR,
      emailVerifiedAt: user.emailVerifiedAt,
    });
    const serialized = JSON.stringify(result);
    for (const forbidden of ['passwordHash', 'normalizedEmail', 'BVN', 'NIN', 'TIN', 'document']) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(result.data).not.toHaveProperty('kycDetails');
    expect(result.data).not.toHaveProperty('documents');
  });
});
