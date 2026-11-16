import { ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStaffDecision, ApplicationStaffReviewEventKind, OnboardingApplicationHistoryEvent, OnboardingApplicationKind, OnboardingApplicationStatus, Prisma, UserRole, VerificationConsentEventKind, VerificationDocumentEventKind, VerificationRulesetLifecycle, VerificationSubjectResolutionState } from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CORPORATE_STAFF_REVIEW_AUTHORIZER, CorporateStaffReviewAuthorizer } from './corporate-staff-review-authorizer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ROLES: readonly UserRole[] = [UserRole.STAFF, UserRole.ADMIN];
const FINAL_EVENT_KINDS: readonly ApplicationStaffReviewEventKind[] = [
  ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_APPROVED,
  ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_REJECTED,
];

/**
 * Internal least-privilege queue and review workflow. The production authorizer
 * denies every operation; no HTTP routes or applicant-accessible staff actions.
 */
@Injectable()
export class CorporateStaffReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(CORPORATE_STAFF_REVIEW_AUTHORIZER) private readonly authorizer: CorporateStaffReviewAuthorizer,
  ) {}

  async authorizedQueue(principal: AuthPrincipal | null | undefined): Promise<readonly {
    applicationId: string; status: OnboardingApplicationStatus; createdAt: Date; snapshotId: string;
  }[]> {
    const actor = await this.requireStaff(principal);
    if (!this.enabled() || !await this.authorizer.authorizeQueue(actor)) throw denied();
    const candidates = await this.prisma.onboardingApplication.findMany({
      where: {
        kind: OnboardingApplicationKind.CORPORATE,
        status: { in: [OnboardingApplicationStatus.SUBMITTED, OnboardingApplicationStatus.IN_REVIEW, OnboardingApplicationStatus.INFO_REQUESTED] },
        submittedAt: { not: null },
        submittedByUserId: { not: null },
        rulesetPin: { isNot: null },
      },
      orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
      take: 200,
      include: {
        rulesetPin: { select: { bindingId: true, rulesetVersionId: true } },
        verificationSnapshots: { orderBy: { generation: 'desc' }, take: 1, select: { id: true, bindingId: true, rulesetVersionId: true, corporateDetailsVersion: true } },
        corporateDetails: { select: { version: true } },
      },
    });
    return candidates.flatMap((item) => {
      const snapshot = item.verificationSnapshots[0];
      if (!snapshot || snapshot.corporateDetailsVersion !== item.corporateDetails?.version ||
        snapshot.bindingId !== item.rulesetPin?.bindingId || snapshot.rulesetVersionId !== item.rulesetPin?.rulesetVersionId) return [];
      return [{ applicationId: item.id, status: item.status, createdAt: item.createdAt, snapshotId: snapshot.id }];
    });
  }

  async startReview(
    principal: AuthPrincipal | null | undefined,
    input: { readonly applicationId: string; readonly operationId: string },
  ): Promise<{ applicationId: string; status: OnboardingApplicationStatus; auditEventId: string; idempotentReplay: boolean }> {
    const actor = await this.requireStaff(principal);
    if (!this.enabled() || !UUID.test(input.applicationId) || !UUID.test(input.operationId) ||
      !await this.authorizer.authorizeReview(actor, input.applicationId)) throw denied();

    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.applicationStaffReviewEvent.findUnique({ where: { operationId: input.operationId } });
      if (replay) {
        if (replay.applicationId !== input.applicationId || replay.actorUserId !== actor.userId || replay.eventKind !== ApplicationStaffReviewEventKind.REVIEW_STARTED) throw denied();
        return { applicationId: replay.applicationId, status: OnboardingApplicationStatus.IN_REVIEW, auditEventId: replay.id, idempotentReplay: true };
      }
      const context = await this.loadPinnedContext(tx, input.applicationId);
      if (context.application.status !== OnboardingApplicationStatus.SUBMITTED) throw conflict();
      if (context.application.initiatingUserId === actor.userId) throw denied();
      const changed = await tx.onboardingApplication.updateMany({
        where: { id: context.application.id, status: OnboardingApplicationStatus.SUBMITTED },
        data: { status: OnboardingApplicationStatus.IN_REVIEW },
      });
      if (changed.count !== 1) throw conflict();
      const event = await tx.applicationStaffReviewEvent.create({
        data: {
          operationId: input.operationId,
          applicationId: context.application.id,
          snapshotId: context.snapshot.id,
          rulesetVersionId: context.snapshot.rulesetVersionId,
          actorUserId: actor.userId,
          eventKind: ApplicationStaffReviewEventKind.REVIEW_STARTED,
          requirementIds: [],
        },
      });
      await tx.onboardingApplicationHistory.create({
        data: {
          applicationId: context.application.id,
          event: OnboardingApplicationHistoryEvent.IN_REVIEW,
          fromStatus: OnboardingApplicationStatus.SUBMITTED,
          toStatus: OnboardingApplicationStatus.IN_REVIEW,
          actorUserId: actor.userId,
        },
      });
      return { applicationId: context.application.id, status: OnboardingApplicationStatus.IN_REVIEW, auditEventId: event.id, idempotentReplay: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  }

  async requestInformation(
    principal: AuthPrincipal | null | undefined,
    input: { readonly applicationId: string; readonly operationId: string; readonly requirementIds: readonly string[] },
  ): Promise<{ applicationId: string; status: OnboardingApplicationStatus; auditEventId: string }> {
    const actor = await this.requireStaff(principal);
    if (!this.enabled() || !UUID.test(input.applicationId) || !UUID.test(input.operationId) || !input.requirementIds.length ||
      input.requirementIds.some((id) => !UUID.test(id)) || new Set(input.requirementIds).size !== input.requirementIds.length ||
      !await this.authorizer.authorizeReview(actor, input.applicationId)) throw denied();

    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.applicationStaffReviewEvent.findUnique({ where: { operationId: input.operationId } });
      if (replay) {
        if (replay.applicationId !== input.applicationId || replay.actorUserId !== actor.userId || replay.eventKind !== ApplicationStaffReviewEventKind.INFORMATION_REQUESTED) throw denied();
        return { applicationId: replay.applicationId, status: OnboardingApplicationStatus.INFO_REQUESTED, auditEventId: replay.id };
      }
      const context = await this.loadPinnedContext(tx, input.applicationId);
      if (context.application.status !== OnboardingApplicationStatus.IN_REVIEW || context.application.initiatingUserId === actor.userId) throw conflict();
      await requireSnapshotRequirements(tx, context.snapshot.id, input.requirementIds);
      const event = await tx.applicationStaffReviewEvent.create({
        data: {
          operationId: input.operationId,
          applicationId: input.applicationId,
          snapshotId: context.snapshot.id,
          rulesetVersionId: context.snapshot.rulesetVersionId,
          actorUserId: actor.userId,
          eventKind: ApplicationStaffReviewEventKind.INFORMATION_REQUESTED,
          requirementIds: [...input.requirementIds],
        },
      });
      const changed = await tx.onboardingApplication.updateMany({
        where: { id: input.applicationId, status: OnboardingApplicationStatus.IN_REVIEW },
        data: { status: OnboardingApplicationStatus.INFO_REQUESTED },
      });
      if (changed.count !== 1) throw conflict();
      await tx.onboardingApplicationHistory.create({
        data: {
          applicationId: input.applicationId,
          event: OnboardingApplicationHistoryEvent.INFO_REQUESTED,
          fromStatus: OnboardingApplicationStatus.IN_REVIEW,
          toStatus: OnboardingApplicationStatus.INFO_REQUESTED,
          actorUserId: actor.userId,
        },
      });
      return { applicationId: input.applicationId, status: OnboardingApplicationStatus.INFO_REQUESTED, auditEventId: event.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  }

  async recordDecision(
    principal: AuthPrincipal | null | undefined,
    input: { readonly applicationId: string; readonly operationId: string; readonly decision: ApplicationStaffDecision; readonly requirementIds: readonly string[] },
  ): Promise<{ applicationId: string; decision: ApplicationStaffDecision; auditEventId: string; idempotentReplay: boolean }> {
    const actor = await this.requireStaff(principal);
    if (!this.enabled() || !UUID.test(input.applicationId) || !UUID.test(input.operationId) ||
      !Object.values(ApplicationStaffDecision).includes(input.decision) || input.requirementIds.some((id) => !UUID.test(id)) ||
      !await this.authorizer.authorizeReview(actor, input.applicationId)) throw denied();

    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.applicationStaffReviewEvent.findUnique({ where: { operationId: input.operationId } });
      if (replay) {
        if (replay.applicationId !== input.applicationId || replay.actorUserId !== actor.userId || replay.eventKind !== ApplicationStaffReviewEventKind.DECISION_RECORDED || replay.decision !== input.decision) throw denied();
        return { applicationId: replay.applicationId, decision: input.decision, auditEventId: replay.id, idempotentReplay: true };
      }
      const context = await this.loadPinnedContext(tx, input.applicationId);
      if (context.application.status !== OnboardingApplicationStatus.IN_REVIEW || context.application.initiatingUserId === actor.userId) throw conflict();
      if (input.requirementIds.length) await requireSnapshotRequirements(tx, context.snapshot.id, input.requirementIds);
      if (input.decision === ApplicationStaffDecision.APPROVE && !await verificationEvidenceComplete(tx, context.application.id, context.snapshot.id)) throw conflict();
      const event = await tx.applicationStaffReviewEvent.create({
        data: {
          operationId: input.operationId,
          applicationId: input.applicationId,
          snapshotId: context.snapshot.id,
          rulesetVersionId: context.snapshot.rulesetVersionId,
          actorUserId: actor.userId,
          eventKind: ApplicationStaffReviewEventKind.DECISION_RECORDED,
          decision: input.decision,
          requirementIds: [...input.requirementIds],
        },
      });
      return { applicationId: input.applicationId, decision: input.decision, auditEventId: event.id, idempotentReplay: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  }

  async finalizeCompliance(
    principal: AuthPrincipal | null | undefined,
    input: { readonly applicationId: string; readonly operationId: string; readonly decisionEventId: string },
  ): Promise<{ applicationId: string; status: OnboardingApplicationStatus; auditEventId: string }> {
    const actor = await this.requireStaff(principal);
    if (!this.enabled() || !UUID.test(input.applicationId) || !UUID.test(input.operationId) || !UUID.test(input.decisionEventId) ||
      !await this.authorizer.authorizeFinalCompliance(actor, input.applicationId)) throw denied();

    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.applicationStaffReviewEvent.findUnique({ where: { operationId: input.operationId } });
      if (replay) {
        if (replay.applicationId !== input.applicationId || replay.actorUserId !== actor.userId ||
          !FINAL_EVENT_KINDS.includes(replay.eventKind)) throw denied();
        return {
          applicationId: replay.applicationId,
          status: replay.eventKind === ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_APPROVED ? OnboardingApplicationStatus.APPROVED : OnboardingApplicationStatus.REJECTED,
          auditEventId: replay.id,
        };
      }
      const context = await this.loadPinnedContext(tx, input.applicationId);
      if (context.application.status !== OnboardingApplicationStatus.IN_REVIEW || context.application.initiatingUserId === actor.userId) throw conflict();
      const decisionEvent = await tx.applicationStaffReviewEvent.findFirst({
        where: {
          id: input.decisionEventId,
          applicationId: input.applicationId,
          snapshotId: context.snapshot.id,
          eventKind: ApplicationStaffReviewEventKind.DECISION_RECORDED,
        },
      });
      if (!decisionEvent || decisionEvent.actorUserId === actor.userId || !decisionEvent.decision) throw denied();
      if (decisionEvent.decision === ApplicationStaffDecision.APPROVE && !await verificationEvidenceComplete(tx, context.application.id, context.snapshot.id)) throw conflict();
      const approval = decisionEvent.decision === ApplicationStaffDecision.APPROVE;
      const eventKind = approval ? ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_APPROVED : ApplicationStaffReviewEventKind.FINAL_COMPLIANCE_REJECTED;
      const status = approval ? OnboardingApplicationStatus.APPROVED : OnboardingApplicationStatus.REJECTED;
      const event = await tx.applicationStaffReviewEvent.create({
        data: {
          operationId: input.operationId,
          applicationId: input.applicationId,
          snapshotId: context.snapshot.id,
          rulesetVersionId: context.snapshot.rulesetVersionId,
          actorUserId: actor.userId,
          eventKind,
          decision: decisionEvent.decision,
          relatedEventId: decisionEvent.id,
          requirementIds: [],
        },
      });
      const changed = await tx.onboardingApplication.updateMany({
        where: { id: input.applicationId, status: OnboardingApplicationStatus.IN_REVIEW },
        data: { status },
      });
      if (changed.count !== 1) throw conflict();
      await tx.onboardingApplicationHistory.create({
        data: {
          applicationId: input.applicationId,
          event: approval ? OnboardingApplicationHistoryEvent.APPROVED : OnboardingApplicationHistoryEvent.REJECTED,
          fromStatus: OnboardingApplicationStatus.IN_REVIEW,
          toStatus: status,
          actorUserId: actor.userId,
        },
      });
      return { applicationId: input.applicationId, status, auditEventId: event.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 20_000 });
  }

  private async loadPinnedContext(tx: Prisma.TransactionClient, applicationId: string) {
    const application = await tx.onboardingApplication.findFirst({
      where: { id: applicationId, kind: OnboardingApplicationKind.CORPORATE },
      include: {
        corporateDetails: { select: { version: true } },
        rulesetPin: true,
        verificationSnapshots: { orderBy: { generation: 'desc' }, take: 1, select: { id: true, bindingId: true, rulesetVersionId: true, corporateDetailsVersion: true } },
      },
    });
    const snapshot = application?.verificationSnapshots[0];
    const pin = application?.rulesetPin;
    if (!application || !snapshot || !pin || !application.corporateDetails ||
      snapshot.corporateDetailsVersion !== application.corporateDetails.version || snapshot.bindingId !== pin.bindingId ||
      snapshot.rulesetVersionId !== pin.rulesetVersionId || pin.applicationId !== application.id) throw conflict();
    const version = await tx.verificationRulesetVersion.findUnique({ where: { id: snapshot.rulesetVersionId }, select: { lifecycle: true, approvedAt: true, approvedByUserId: true, publishedAt: true, publishedByUserId: true } });
    if (!version || version.lifecycle !== VerificationRulesetLifecycle.PUBLISHED || !version.approvedAt || !version.approvedByUserId || !version.publishedAt || !version.publishedByUserId) throw conflict();
    return { application, snapshot };
  }

  private async requireStaff(principal: AuthPrincipal | null | undefined): Promise<AuthPrincipal> {
    if (!principal || !UUID.test(principal.userId) || !principal.sessionId || !STAFF_ROLES.includes(principal.role)) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: principal.userId }, select: { id: true, role: true } });
    if (!user || user.role !== principal.role || !STAFF_ROLES.includes(user.role)) throw denied();
    return principal;
  }

  private enabled(): boolean {
    return this.config.get<boolean>('verification.staffReviewEnabled') === true;
  }
}

async function requireSnapshotRequirements(tx: Prisma.TransactionClient, snapshotId: string, requirementIds: readonly string[]): Promise<void> {
  const rows = await tx.applicationVerificationRequirement.findMany({ where: { id: { in: [...requirementIds] }, snapshotId }, select: { id: true } });
  if (rows.length !== new Set(requirementIds).size) throw conflict();
}

async function verificationEvidenceComplete(tx: Prisma.TransactionClient, applicationId: string, snapshotId: string): Promise<boolean> {
  const [snapshot, requirements] = await Promise.all([
    tx.applicationVerificationSnapshot.findUnique({ where: { id: snapshotId }, include: { rulesetVersion: { include: { subjectDefinitions: true } } } }),
    tx.applicationVerificationRequirement.findMany({
      where: { snapshotId },
      include: {
        subject: true,
        sourceCheckDefinition: { include: { acceptedEvidenceSources: true } },
      },
    }),
  ]);
  if (!snapshot || !requirements.length || snapshot.applicationId !== applicationId) return false;
  if (requirements.some((requirement) => requirement.state !== 'PENDING' || requirement.unresolvedIssue !== null)) return false;
  for (const requirement of requirements) {
    if (requirement.requirementKind === 'VERIFICATION_CHECK') {
      if (!requirement.subject || requirement.subject.resolutionState !== VerificationSubjectResolutionState.RESOLVED || !requirement.sourceCheckDefinition) return false;
      const accepted = requirement.sourceCheckDefinition.acceptedEvidenceSources.map((source) => source.evidenceSourceKey);
      const attempts = await tx.providerVerificationAttempt.findMany({
        where: { applicationId, requirementId: requirement.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { events: { orderBy: { sequence: 'desc' }, take: 1 }, consentEvent: true },
      });
      const matching = attempts.find((attempt) => {
        const latest = attempt.events[0];
        return latest?.status === 'PROVIDER_VERIFIED' && accepted.includes(attempt.providerKey) &&
          attempt.subjectSnapshotId === requirement.subjectSnapshotId &&
          (requirement.subject?.resolvedUserId ? attempt.subjectUserId === requirement.subject.resolvedUserId : attempt.subjectUserId === null);
      });
      if (!matching) return false;
      const latestConsent = await tx.verificationConsentEvent.findFirst({
        where: { applicationId, actorUserId: matching.actorUserId, providerKey: matching.providerKey },
        orderBy: { sequence: 'desc' },
      });
      if (matching.consentEvent.eventKind !== VerificationConsentEventKind.GRANTED || latestConsent?.id !== matching.consentEventId) return false;
    } else if (requirement.requirementKind === 'CONDITIONAL_DOCUMENT') {
      if (!requirement.documentKindKeySnapshot) return false;
      const documents = await tx.verificationDocument.findMany({
        where: { applicationId, requirementId: requirement.id, replacements: { none: {} } },
        include: { events: { orderBy: { sequence: 'desc' } } },
      });
      if (!documents.some((document) => effectiveDocumentState(document.events) === VerificationDocumentEventKind.SCAN_CLEAN &&
        document.documentKindKey === requirement.documentKindKeySnapshot)) return false;
    } else if (requirement.requirementKind === 'STAFF_REVIEW') {
      const started = await tx.applicationStaffReviewEvent.findFirst({
        where: { applicationId, snapshotId, eventKind: ApplicationStaffReviewEventKind.REVIEW_STARTED }, select: { id: true },
      });
      if (!started) return false;
    }
  }
  return true;
}

function effectiveDocumentState(events: readonly { eventKind: VerificationDocumentEventKind }[]): VerificationDocumentEventKind | null {
  return events.find((event) => event.eventKind !== VerificationDocumentEventKind.ACCESS_GRANTED)?.eventKind ?? null;
}

function denied(): ForbiddenException {
  return new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not have access to this resource.' });
}

function conflict(): ConflictException {
  return new ConflictException({ code: 'CONFLICT', message: 'Corporate review requirements are incomplete, stale, or unavailable.' });
}
