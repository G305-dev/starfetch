import { PrimaryAccountType, UserRole } from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';

const principal: AuthPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  role: UserRole.INVESTOR,
  sessionId: '22222222-2222-4222-8222-222222222222',
};

describe('CorporateApplicantContextService', () => {
  it('authorizes a verified Corporate applicant without requiring an InvestorProfile', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: principal.userId,
          role: UserRole.INVESTOR,
          emailVerifiedAt: new Date(),
          primaryAccountType: PrimaryAccountType.CORPORATE,
          corporateApplicantProfile: { id: 'profile' },
          initiatedOnboardingApplications: [],
        }),
      },
    } as any;
    const service = new CorporateApplicantContextService(prisma);

    await expect(service.requireVerifiedInvestor(principal)).resolves.toEqual({
      initiatingUserId: principal.userId,
      role: UserRole.INVESTOR,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: principal.userId },
      select: {
        id: true, role: true, emailVerifiedAt: true, primaryAccountType: true,
        corporateApplicantProfile: { select: { id: true } },
        initiatedOnboardingApplications: { where: { kind: 'CORPORATE', ownerCorporateAccountId: { not: null } }, select: { id: true }, take: 1 },
      },
    });
  });

  it('allows an operator-recovered Corporate account to resume Corporate onboarding without a prior O2 application', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({
      id: principal.userId, role: UserRole.INVESTOR, emailVerifiedAt: new Date(),
      primaryAccountType: PrimaryAccountType.CORPORATE, corporateApplicantProfile: null,
      initiatedOnboardingApplications: [],
    }) } } as any;
    const service = new CorporateApplicantContextService(prisma);
    await expect(service.requireVerifiedInvestor(principal)).resolves.toEqual({
      initiatingUserId: principal.userId,
      role: UserRole.INVESTOR,
    });
  });

  it('rejects an ambiguous legacy account without evidence or operator recovery', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({
      id: principal.userId, role: UserRole.INVESTOR, emailVerifiedAt: new Date(), primaryAccountType: null,
      corporateApplicantProfile: null, initiatedOnboardingApplications: [],
    }) } } as any;
    const service = new CorporateApplicantContextService(prisma);
    await expect(service.requireVerifiedInvestor(principal)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an Individual-only session without corporate registration or owned Corporate evidence', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({
      id: principal.userId, role: UserRole.INVESTOR, emailVerifiedAt: new Date(),
      primaryAccountType: PrimaryAccountType.INDIVIDUAL, corporateApplicantProfile: null,
      initiatedOnboardingApplications: [],
    }) } } as any;
    const service = new CorporateApplicantContextService(prisma);
    await expect(service.requireVerifiedInvestor(principal)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a missing principal as unauthenticated without a database lookup', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const service = new CorporateApplicantContextService(prisma);
    await expect(service.requireVerifiedInvestor(undefined)).rejects.toMatchObject({ status: 401 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-investor token roles before a database lookup', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const service = new CorporateApplicantContextService(prisma);
    await expect(service.requireVerifiedInvestor({ ...principal, role: UserRole.ADMIN }))
      .rejects.toMatchObject({ status: 403 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an unverified current database user with EMAIL_NOT_VERIFIED', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: principal.userId,
          role: UserRole.INVESTOR,
          emailVerifiedAt: null,
        }),
      },
    } as any;
    const service = new CorporateApplicantContextService(prisma);
    await expect(service.requireVerifiedInvestor(principal)).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }),
    });
  });

  it('rejects a database role change after token issuance', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: principal.userId,
          role: UserRole.STAFF,
          emailVerifiedAt: new Date(),
        }),
      },
    } as any;
    const service = new CorporateApplicantContextService(prisma);
    await expect(service.requireVerifiedInvestor(principal)).rejects.toMatchObject({ status: 403 });
  });
});
