import { Logger } from '@nestjs/common';
import { OnboardingApplicationKind, OnboardingApplicationStatus, UserRole } from '@prisma/client';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CorporateInvestmentEligibilityService } from '../corporate-onboarding/services/corporate-investment-eligibility.service';
import { KycCompletionService } from './kyc-completion.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PRINCIPAL: AuthPrincipal = {
  userId: USER_ID,
  role: UserRole.INVESTOR,
  sessionId: '22222222-2222-4222-8222-222222222222',
};
const VERIFIED_CONTEXT = { role: UserRole.INVESTOR, emailVerifiedAt: new Date('2026-11-13T12:00:00.000Z') };

describe('KycCompletionService', () => {
  function setup(applications: Array<{ id: string; status: OnboardingApplicationStatus }> = [], eligible = true) {
    const prisma = {
      onboardingApplication: { findMany: jest.fn().mockResolvedValue(applications) },
    };
    const corporateEligibility = {
      assess: jest.fn(async (_principal: AuthPrincipal, applicationId: string) => ({
        applicationId,
        eligible,
        canAccessInvestment: eligible,
        issueCodes: eligible ? [] : ['SNAPSHOT_MISSING_OR_STALE'],
      })),
    };
    const service = new KycCompletionService(
      prisma as unknown as PrismaService,
      corporateEligibility as unknown as CorporateInvestmentEligibilityService,
    );
    return { service, prisma, corporateEligibility };
  }

  it('returns REQUIRED for an Individual when there is no final Individual KYC approval source', async () => {
    const { service } = setup();
    await expect(service.forPrincipal(PRINCIPAL, VERIFIED_CONTEXT)).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
  });

  it('returns REQUIRED for a Corporate applicant with no associated approved Corporate application', async () => {
    const { service, prisma, corporateEligibility } = setup();
    await expect(service.forPrincipal(PRINCIPAL, VERIFIED_CONTEXT)).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
    expect(prisma.onboardingApplication.findMany).toHaveBeenCalledWith({
      where: {
        kind: OnboardingApplicationKind.CORPORATE,
        initiatingUserId: USER_ID,
        ownerCorporateAccountId: { not: null },
      },
      select: { id: true, status: true },
    });
    expect(corporateEligibility.assess).not.toHaveBeenCalled();
  });

  it('supports a profileless Corporate applicant and returns COMPLETE only after the existing eligibility gate passes', async () => {
    const { service, corporateEligibility } = setup([{ id: 'app-1', status: OnboardingApplicationStatus.APPROVED }]);
    // No InvestorProfile is supplied or queried; Corporate identity is owned
    // through the Corporate application initiated by this authenticated user.
    await expect(service.forPrincipal(PRINCIPAL, VERIFIED_CONTEXT)).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'COMPLETE',
    });
    expect(corporateEligibility.assess).toHaveBeenCalledWith(PRINCIPAL, 'app-1');
  });

  it.each([
    OnboardingApplicationStatus.DRAFT,
    OnboardingApplicationStatus.SUBMITTED,
    OnboardingApplicationStatus.IN_REVIEW,
    OnboardingApplicationStatus.INFO_REQUESTED,
    OnboardingApplicationStatus.REJECTED,
  ])('returns REQUIRED for an unfinished or rejected Corporate application (%s)', async (status) => {
    const { service, corporateEligibility } = setup([{ id: 'app-1', status }]);
    await expect(service.forPrincipal(PRINCIPAL, VERIFIED_CONTEXT)).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
    expect(corporateEligibility.assess).not.toHaveBeenCalled();
  });

  it('returns REQUIRED when existing evidence is stale, incomplete, or otherwise ineligible', async () => {
    const { service } = setup([{ id: 'app-1', status: OnboardingApplicationStatus.APPROVED }], false);
    await expect(service.forPrincipal(PRINCIPAL, VERIFIED_CONTEXT)).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
  });

  it('requires all Corporate applications associated with the user to pass the current gate', async () => {
    const { service } = setup([
      { id: 'app-complete', status: OnboardingApplicationStatus.APPROVED },
      { id: 'app-other', status: OnboardingApplicationStatus.APPROVED },
    ], false);
    await expect(service.forPrincipal(PRINCIPAL, VERIFIED_CONTEXT)).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
  });

  it('fails closed to REQUIRED when evidence status cannot be read', async () => {
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, prisma } = setup();
    prisma.onboardingApplication.findMany.mockRejectedValueOnce(new Error('synthetic database failure'));
    await expect(service.forPrincipal(PRINCIPAL, VERIFIED_CONTEXT)).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
    expect(warning).toHaveBeenCalledWith('KYC completion evidence could not be confirmed; returning REQUIRED.');
    warning.mockRestore();
  });

  it('returns REQUIRED when email is unverified or the live caller role is not INVESTOR', async () => {
    const { service, prisma } = setup([{ id: 'app-1', status: OnboardingApplicationStatus.APPROVED }]);
    await expect(service.forPrincipal(PRINCIPAL, { ...VERIFIED_CONTEXT, emailVerifiedAt: null })).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
    await expect(service.forPrincipal(PRINCIPAL, { ...VERIFIED_CONTEXT, role: UserRole.ADMIN })).resolves.toEqual({
      individual: 'REQUIRED',
      corporate: 'REQUIRED',
    });
    expect(prisma.onboardingApplication.findMany).not.toHaveBeenCalled();
  });
});
