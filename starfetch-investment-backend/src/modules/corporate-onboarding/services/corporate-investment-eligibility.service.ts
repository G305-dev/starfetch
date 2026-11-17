import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStaffReviewEventKind, OnboardingApplicationKind, OnboardingApplicationStatus, VerificationConsentEventKind, VerificationDocumentEventKind, VerificationRulesetLifecycle, VerificationSubjectResolutionState } from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './corporate-application-access.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CorporateEligibilityIssue =
  | 'APPLICATION_NOT_APPROVED'
  | 'SUBMISSION_PIN_MISSING'
  | 'SNAPSHOT_MISSING_OR_STALE'
  | 'RULESET_NOT_PUBLISHED'
  | 'VERIFICATION_REQUIREMENTS_INCOMPLETE'
  | 'INDEPENDENT_APPROVAL_MISSING';

export interface CorporateInvestmentEligibility {
  readonly applicationId: string;
  readonly eligible: boolean;
  readonly canAccessInvestment: boolean;
  readonly issueCodes: readonly CorporateEligibilityIssue[];
}

/** Server-side gate for future Corporate investment operations; no route grants access. */
@Injectable()
export class CorporateInvestmentEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicantContext: CorporateApplicantContextService,
    private readonly applicationAccess: CorporateApplicationAccessService,
  ) {}

  async assess(principal: AuthPrincipal | null | undefined, applicationId: string): Promise<CorporateInvestmentEligibility> {
    const applicant = await this.applicantContext.requireVerifiedInvestor(principal);
    if (!UUID.test(applicationId)) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Application not found.' });
    const application = await this.applicationAccess.requireInitiatorOwnedCorporateApplication(applicant, applicationId);
    const current = await this.prisma.onboardingApplication.findUnique({
      where: { id: application.id },
      include: {
        corporateDetails: { select: { version: true } },
        rulesetPin: true,
        verificationSnapshots: {
          orderBy: { generation: 'desc' }, take: 1,
          include: { requirements: true, rulesetVersion: { select: { lifecycle: true, approvedAt: true, approvedByUserId: true, publishedAt: true, publishedByUserId: true } } },
        },
      },
    });
    if (!current) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Application not found.' });
    const issues: CorporateEligibilityIssue[] = [];
    if (current.kind !== OnboardingApplicationKind.CORPORATE || current.status !== OnboardingApplicationStatus.APPROVED) issues.push('APPLICATION_NOT_APPROVED');
    const snapshot = current.verificationSnapshots[0];
    const pin = current.rulesetPin;
    if (!pin) issues.push('SUBMISSION_PIN_MISSING');
    if (!snapshot || !current.corporateDetails || snapshot.corporateDetailsVersion !== current.corporateDetails.version ||
      !pin || snapshot.bindingId !== pin.bindingId || snapshot.rulesetVersionId !== pin.rulesetVersionId) issues.push('SNAPSHOT_MISSING_OR_STALE');
    if (snapshot && (snapshot.rulesetVersion.lifecycle !== VerificationRulesetLifecycle.PUBLISHED || !snapshot.rulesetVersion.approvedAt ||
      !snapshot.rulesetVersion.approvedByUserId || !snapshot.rulesetVersion.publishedAt || !snapshot.rulesetVersion.publishedByUserId)) {
      issues.push('RULESET_NOT_PUBLISHED');
    }
    if (snapshot) {
      const [complete, finalApproval] = await Promise.all([
        tierRequirementsComplete(this.prisma, current.id, snapshot.id, snapshot.requirements),
        this.prisma.applicationStaffReviewEvent.findFirst({
          where: {
            applicationId: current.id,
            snapshotId: snapshot.id,
            eventKind: ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_APPROVED,
            decision: 'APPROVE',
            actorUserId: { not: current.initiatingUserId },
          },
          select: { id: true },
        }),
      ]);
      if (!complete) issues.push('VERIFICATION_REQUIREMENTS_INCOMPLETE');
      if (!finalApproval) issues.push('INDEPENDENT_APPROVAL_MISSING');
    } else {
      issues.push('VERIFICATION_REQUIREMENTS_INCOMPLETE', 'INDEPENDENT_APPROVAL_MISSING');
    }
    const uniqueIssues = [...new Set(issues)];
    const eligible = uniqueIssues.length === 0;
    return { applicationId: current.id, eligible, canAccessInvestment: eligible, issueCodes: uniqueIssues };
  }

  async assertEligible(principal: AuthPrincipal | null | undefined, applicationId: string): Promise<void> {
    const result = await this.assess(principal, applicationId);
    if (!result.eligible) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Corporate investment access is not available.' });
  }
}

async function tierRequirementsComplete(
  prisma: PrismaService,
  applicationId: string,
  snapshotId: string,
  requirements: readonly { id: string; requirementKind: string; state: string; unresolvedIssue: string | null; subjectSnapshotId: string | null; documentKindKeySnapshot: string | null }[],
): Promise<boolean> {
  if (requirements.length === 0 || requirements.some((requirement) => requirement.state !== 'PENDING' || requirement.unresolvedIssue !== null)) return false;
  for (const requirement of requirements) {
    if (requirement.requirementKind === 'VERIFICATION_CHECK') {
      const full = await prisma.applicationVerificationRequirement.findUnique({
        where: { id: requirement.id },
        include: { subject: true, sourceCheckDefinition: { include: { acceptedEvidenceSources: true } } },
      });
      if (!full?.subject || full.subject.resolutionState !== VerificationSubjectResolutionState.RESOLVED || !full.sourceCheckDefinition) return false;
      const accepted = full.sourceCheckDefinition.acceptedEvidenceSources.map((source) => source.evidenceSourceKey);
      const attempts = await prisma.providerVerificationAttempt.findMany({
        where: { applicationId, requirementId: requirement.id },
        include: { events: { orderBy: { sequence: 'desc' }, take: 1 }, consentEvent: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      let matched = false;
      for (const attempt of attempts) {
        const latestEvidence = attempt.events[0];
        if (!latestEvidence || latestEvidence.status !== 'PROVIDER_VERIFIED' || !accepted.includes(attempt.providerKey) ||
          attempt.subjectSnapshotId !== requirement.subjectSnapshotId ||
          (full.subject.resolvedUserId ? attempt.subjectUserId !== full.subject.resolvedUserId : attempt.subjectUserId !== null)) continue;
        const currentConsent = await prisma.verificationConsentEvent.findFirst({
          where: { applicationId, actorUserId: attempt.actorUserId, providerKey: attempt.providerKey },
          orderBy: { sequence: 'desc' },
        });
        if (attempt.consentEvent.eventKind === VerificationConsentEventKind.GRANTED && currentConsent?.id === attempt.consentEventId) {
          matched = true;
          break;
        }
      }
      if (!matched) return false;
    } else if (requirement.requirementKind === 'CONDITIONAL_DOCUMENT') {
      if (!requirement.documentKindKeySnapshot) return false;
      const documents = await prisma.verificationDocument.findMany({
        where: { applicationId, requirementId: requirement.id, replacements: { none: {} } },
        include: { events: { orderBy: { sequence: 'desc' } } },
      });
      if (!documents.some((document) => document.documentKindKey === requirement.documentKindKeySnapshot && latestDocumentState(document.events) === VerificationDocumentEventKind.SCAN_CLEAN)) return false;
    } else if (requirement.requirementKind === 'STAFF_REVIEW') {
      const [started, decision] = await Promise.all([
        prisma.applicationStaffReviewEvent.findFirst({ where: { applicationId, snapshotId, eventKind: ApplicationStaffReviewEventKind.REVIEW_STARTED }, select: { id: true } }),
        prisma.applicationStaffReviewEvent.findFirst({ where: { applicationId, snapshotId, eventKind: ApplicationStaffReviewEventKind.DECISION_RECORDED }, select: { id: true } }),
      ]);
      if (!started || !decision) return false;
    } else if (requirement.requirementKind === 'INDEPENDENT_COMPLIANCE_APPROVAL') {
      const approval = await prisma.applicationStaffReviewEvent.findFirst({
        where: { applicationId, snapshotId, eventKind: ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_APPROVED, decision: 'APPROVE' },
        select: { id: true },
      });
      if (!approval) return false;
    } else return false;
  }
  return true;
}

function latestDocumentState(events: readonly { eventKind: VerificationDocumentEventKind }[]): VerificationDocumentEventKind | null {
  return events.find((event) => event.eventKind !== VerificationDocumentEventKind.ACCESS_GRANTED)?.eventKind ?? null;
}
