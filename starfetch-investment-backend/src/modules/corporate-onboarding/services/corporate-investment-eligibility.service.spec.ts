import {
  ApplicationStaffReviewEventKind,
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  VerificationRulesetLifecycle,
} from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './corporate-application-access.service';
import { CorporateInvestmentEligibilityService } from './corporate-investment-eligibility.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const APPLICATION_ID = '33333333-3333-4333-8333-333333333333';
const SNAPSHOT_ID = '44444444-4444-4444-8444-444444444444';
const BINDING_ID = '55555555-5555-4555-8555-555555555555';
const RULESET_ID = '66666666-6666-4666-8666-666666666666';
const PRINCIPAL: AuthPrincipal = {
  userId: USER_ID,
  role: 'INVESTOR' as AuthPrincipal['role'],
  sessionId: '22222222-2222-4222-8222-222222222222',
};

function fixture(options: { staleDetails?: boolean; complete?: boolean; finalApproval?: boolean } = {}) {
  const now = new Date('2026-11-13T12:00:00.000Z');
  const requirements = [
    { id: 'staff-review-req', requirementKind: 'STAFF_REVIEW', state: 'PENDING', unresolvedIssue: null, subjectSnapshotId: null, documentKindKeySnapshot: null },
    { id: 'compliance-req', requirementKind: 'INDEPENDENT_COMPLIANCE_APPROVAL', state: 'PENDING', unresolvedIssue: null, subjectSnapshotId: null, documentKindKeySnapshot: null },
  ];
  const current = {
    id: APPLICATION_ID,
    kind: OnboardingApplicationKind.CORPORATE,
    status: OnboardingApplicationStatus.APPROVED,
    initiatingUserId: USER_ID,
    corporateDetails: { version: 4 },
    rulesetPin: { bindingId: BINDING_ID, rulesetVersionId: RULESET_ID },
    verificationSnapshots: [{
      id: SNAPSHOT_ID,
      bindingId: BINDING_ID,
      rulesetVersionId: RULESET_ID,
      corporateDetailsVersion: options.staleDetails ? 3 : 4,
      requirements: options.complete ? requirements : [{ ...requirements[0], state: 'UNRESOLVED' }, requirements[1]],
      rulesetVersion: {
        lifecycle: VerificationRulesetLifecycle.PUBLISHED,
        approvedAt: now,
        approvedByUserId: '77777777-7777-4777-8777-777777777777',
        publishedAt: now,
        publishedByUserId: '88888888-8888-4888-8888-888888888888',
      },
    }],
  };
  const findFirst = jest.fn(async (args: { where: { eventKind: ApplicationStaffReviewEventKind; actorUserId?: unknown } }) => {
    if (args.where.eventKind === ApplicationStaffReviewEventKind.REVIEW_STARTED ||
      args.where.eventKind === ApplicationStaffReviewEventKind.DECISION_RECORDED) return { id: 'review-event' };
    if (args.where.eventKind === ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_APPROVED && options.finalApproval !== false) return { id: 'final-approval' };
    return null;
  });
  const prisma = {
    onboardingApplication: { findUnique: jest.fn().mockResolvedValue(current) },
    applicationStaffReviewEvent: { findFirst },
  };
  const applicantContext = { requireVerifiedInvestor: jest.fn().mockResolvedValue({ initiatingUserId: USER_ID, role: PRINCIPAL.role }) };
  const applicationAccess = { requireInitiatorOwnedCorporateApplication: jest.fn().mockResolvedValue({ id: APPLICATION_ID }) };
  const service = new CorporateInvestmentEligibilityService(
    prisma as unknown as PrismaService,
    applicantContext as unknown as CorporateApplicantContextService,
    applicationAccess as unknown as CorporateApplicationAccessService,
  );
  return { service, prisma, applicantContext, applicationAccess };
}

describe('CorporateInvestmentEligibilityService completion evidence used by GET /me', () => {
  it('accepts only approved apps with a current pinned published snapshot, complete requirements, and independent approval', async () => {
    const { service, applicationAccess, applicantContext } = fixture({ complete: true, finalApproval: true });
    await expect(service.assess(PRINCIPAL, APPLICATION_ID)).resolves.toEqual({
      applicationId: APPLICATION_ID,
      eligible: true,
      canAccessInvestment: true,
      issueCodes: [],
    });
    expect(applicantContext.requireVerifiedInvestor).toHaveBeenCalledWith(PRINCIPAL);
    expect(applicationAccess.requireInitiatorOwnedCorporateApplication).toHaveBeenCalledWith(
      { initiatingUserId: USER_ID, role: PRINCIPAL.role },
      APPLICATION_ID,
    );
  });

  it('returns ineligible when the Corporate details snapshot is stale', async () => {
    const { service } = fixture({ complete: true, staleDetails: true, finalApproval: true });
    const result = await service.assess(PRINCIPAL, APPLICATION_ID);
    expect(result.eligible).toBe(false);
    expect(result.issueCodes).toContain('SNAPSHOT_MISSING_OR_STALE');
  });

  it('returns ineligible when verification requirements are unfinished', async () => {
    const { service } = fixture({ complete: false, finalApproval: true });
    const result = await service.assess(PRINCIPAL, APPLICATION_ID);
    expect(result.eligible).toBe(false);
    expect(result.issueCodes).toContain('VERIFICATION_REQUIREMENTS_INCOMPLETE');
  });

  it('returns ineligible without independently recorded final compliance approval', async () => {
    const { service } = fixture({ complete: true, finalApproval: false });
    const result = await service.assess(PRINCIPAL, APPLICATION_ID);
    expect(result.eligible).toBe(false);
    expect(result.issueCodes).toContain('INDEPENDENT_APPROVAL_MISSING');
  });
});
