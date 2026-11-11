import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  ApplicationVerificationRequirementKind,
  ApplicationVerificationRequirementStage,
  ApplicationVerificationRequirementState,
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  Prisma,
  VerificationResolutionIssue,
  VerificationRulesetLifecycle,
  VerificationSubjectResolutionState,
  VerificationSubjectTargetKind,
} from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SERIALIZATION_RETRIES = 3;
const NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Application not found.' } as const;
const CONFLICT = { code: ERROR_CODES.CONFLICT, message: 'Verification requirements cannot be snapshotted for this application.' } as const;
const UNAUTHENTICATED = { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' } as const;

type SubjectPlan = {
  subjectDefinitionId: string;
  targetKind: VerificationSubjectTargetKind | null;
  resolutionState: VerificationSubjectResolutionState;
  unresolvedIssue: VerificationResolutionIssue | null;
  resolvedUserId: string | null;
  resolvedCorporateAccountId: string | null;
  sourceJointMembershipId: string | null;
};

const SNAPSHOT_INCLUDE = {
  corporateDetails: { select: { version: true } },
  jointOwner: {
    select: {
      membershipVersion: true,
      members: {
        orderBy: [{ joinedAt: 'asc' as const }, { id: 'asc' as const }],
        select: { id: true, userId: true },
      },
    },
  },
  rulesetBinding: {
    include: {
      rulesetVersion: {
        include: {
          subjectDefinitions: { include: { checks: { include: { acceptedEvidenceSources: true } } } },
          documentRequirements: true,
        },
      },
    },
  },
} satisfies Prisma.OnboardingApplicationInclude;

type SnapshotApplication = Prisma.OnboardingApplicationGetPayload<{ include: typeof SNAPSHOT_INCLUDE }>;

/**
 * Internal C1.4 requirement materializer. It resolves identity references only
 * from the authenticated owner's existing account context and the exact bound
 * immutable ruleset version. It creates no verification outcome, evidence,
 * document, submission, pin, or approval.
 */
@Injectable()
export class ApplicationVerificationSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetSnapshot(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
  ): Promise<ApplicationVerificationSnapshotReceipt> {
    if (!principal || !UUID_PATTERN.test(principal.userId) || !principal.sessionId) {
      throw new HttpException(UNAUTHENTICATED, HttpStatus.UNAUTHORIZED);
    }
    if (!UUID_PATTERN.test(applicationId)) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);

    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const application = await tx.onboardingApplication.findFirst({
            where: {
              id: applicationId,
              OR: [
                { kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: principal.userId },
                {
                  kind: OnboardingApplicationKind.JOINT,
                  jointOwner: { members: { some: { userId: principal.userId } } },
                },
                {
                  kind: OnboardingApplicationKind.CORPORATE,
                  initiatingUserId: principal.userId,
                  ownerCorporateAccountId: { not: null },
                },
              ],
            },
            include: SNAPSHOT_INCLUDE,
          });
          if (!application) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);

          // Serialize retries for this application and use SSI for concurrent
          // member/detail changes observed while resolving subjects.
          await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "onboarding_applications" WHERE "id" = ${application.id}::uuid FOR UPDATE
          `;
          let sourceApplication: SnapshotApplication = application;
          if (application.kind === OnboardingApplicationKind.JOINT && application.ownerJointAccountId) {
            // Membership mutations bump this parent revision in a database
            // trigger. Lock it and re-read its current member set before the
            // immutable snapshot is materialized.
            await tx.$queryRaw<Array<{ id: string }>>`
              SELECT "id" FROM "joint_accounts" WHERE "id" = ${application.ownerJointAccountId}::uuid FOR UPDATE
            `;
            const currentJoint = await tx.jointAccount.findUnique({
              where: { id: application.ownerJointAccountId },
              select: SNAPSHOT_INCLUDE.jointOwner.select,
            });
            if (!currentJoint) throw conflict();
            sourceApplication = { ...application, jointOwner: currentJoint };
          }

          const editableStatuses: OnboardingApplicationStatus[] = [
            OnboardingApplicationStatus.DRAFT,
            OnboardingApplicationStatus.INFO_REQUESTED,
          ];
          if (!editableStatuses.includes(application.status)) {
            throw conflict();
          }
          const binding = application.rulesetBinding;
          const version = binding?.rulesetVersion;
          if (
            !binding || !version || binding.applicationId !== application.id ||
            binding.accountKind !== application.kind || version.accountKind !== application.kind ||
            version.lifecycle !== VerificationRulesetLifecycle.PUBLISHED ||
            !version.approvedByUserId || !version.approvedAt || !version.publishedByUserId || !version.publishedAt ||
            !isCompletePublishedVersion(version)
          ) throw conflict();

          const plan = buildSubjectPlan(sourceApplication, version.subjectDefinitions);
          const existing = await tx.applicationVerificationSnapshot.findFirst({
            where: { applicationId: application.id },
            orderBy: { generation: 'desc' },
            include: { subjects: true, requirements: true },
          });
          if (existing && existingSnapshotMatches(existing, sourceApplication, binding.id, version.id, plan)) {
            return receiptFromExisting(existing, binding.id, true);
          }

          // A stale snapshot is never rewritten or deleted. Append a new exact
          // generation after edits/membership changes; the previous generation
          // remains available for audit and freshness comparison.
          const generation = (existing?.generation ?? 0) + 1;
          const snapshot = await tx.applicationVerificationSnapshot.create({
            data: {
              applicationId: application.id,
              generation,
              bindingId: binding.id,
              accountKind: application.kind,
              rulesetVersionId: version.id,
              corporateDetailsVersion: application.kind === OnboardingApplicationKind.CORPORATE
                ? sourceApplication.corporateDetails?.version ?? null
                : null,
              jointMembershipVersion: application.kind === OnboardingApplicationKind.JOINT
                ? sourceApplication.jointOwner?.membershipVersion ?? null
                : null,
              createdByUserId: principal.userId,
            },
          });

          const subjectSnapshotByDefinitionAndIdentity = new Map<string, string>();
          for (const subject of plan) {
            const createdSubject = await tx.applicationVerificationSubjectSnapshot.create({
              data: {
                snapshotId: snapshot.id,
                rulesetVersionId: version.id,
                subjectDefinitionId: subject.subjectDefinitionId,
                targetKind: subject.targetKind,
                resolutionState: subject.resolutionState,
                unresolvedIssue: subject.unresolvedIssue,
                resolvedUserId: subject.resolvedUserId,
                resolvedCorporateAccountId: subject.resolvedCorporateAccountId,
                sourceJointMembershipId: subject.sourceJointMembershipId,
              },
            });
            const identityKey = subjectIdentityKey(subject);
            subjectSnapshotByDefinitionAndIdentity.set(`${subject.subjectDefinitionId}:${identityKey}`, createdSubject.id);
          }

          for (const subject of plan) {
            const subjectSnapshotId = subjectSnapshotByDefinitionAndIdentity.get(
              `${subject.subjectDefinitionId}:${subjectIdentityKey(subject)}`,
            );
            if (!subjectSnapshotId) throw conflict();
            const definition = version.subjectDefinitions.find((candidate) => candidate.id === subject.subjectDefinitionId);
            if (!definition) throw conflict();
            for (const check of definition.checks) {
              const unresolved = subject.resolutionState === VerificationSubjectResolutionState.UNRESOLVED;
              await tx.applicationVerificationRequirement.create({
                data: {
                  snapshotId: snapshot.id,
                  rulesetVersionId: version.id,
                  subjectSnapshotId,
                  requirementKind: ApplicationVerificationRequirementKind.VERIFICATION_CHECK,
                  stage: ApplicationVerificationRequirementStage.TIER_1_BASIC_MONO,
                  state: unresolved
                    ? ApplicationVerificationRequirementState.UNRESOLVED
                    : ApplicationVerificationRequirementState.PENDING,
                  unresolvedIssue: unresolved ? subject.unresolvedIssue : null,
                  requirementKey: `check:${subjectSnapshotId}:${check.id}`,
                  sourceCheckDefinitionId: check.id,
                },
              });
            }
          }

          for (const document of version.documentRequirements) {
            // Condition JSON is preserved verbatim. There is no approved
            // evaluator or declaration data source in this phase, so it is not
            // safe to infer applicability or request a document.
            await tx.applicationVerificationRequirement.create({
              data: {
                snapshotId: snapshot.id,
                rulesetVersionId: version.id,
                requirementKind: ApplicationVerificationRequirementKind.CONDITIONAL_DOCUMENT,
                stage: ApplicationVerificationRequirementStage.TIER_2_DOCUMENTS,
                state: ApplicationVerificationRequirementState.UNRESOLVED,
                unresolvedIssue: VerificationResolutionIssue.DOCUMENT_CONDITION_NOT_EVALUATED,
                requirementKey: `document:${document.id}`,
                sourceDocumentRequirementDefinitionId: document.id,
                documentKindKeySnapshot: document.documentKindKey,
                conditionSnapshot: document.condition as Prisma.InputJsonValue,
                ...(document.completeness === null ? {} : {
                  documentCompletenessSnapshot: document.completeness as Prisma.InputJsonValue,
                }),
              },
            });
          }

          // Tier 3 is represented as two distinct pending gates. No staff or
          // compliance operation exists here, and neither gate can be marked done.
          await tx.applicationVerificationRequirement.createMany({
            data: [
              {
                snapshotId: snapshot.id,
                rulesetVersionId: version.id,
                requirementKind: ApplicationVerificationRequirementKind.STAFF_REVIEW,
                stage: ApplicationVerificationRequirementStage.TIER_3_STAFF_COMPLIANCE,
                state: ApplicationVerificationRequirementState.PENDING,
                requirementKey: 'tier-3:staff-review',
              },
              {
                snapshotId: snapshot.id,
                rulesetVersionId: version.id,
                requirementKind: ApplicationVerificationRequirementKind.INDEPENDENT_COMPLIANCE_APPROVAL,
                stage: ApplicationVerificationRequirementStage.TIER_3_STAFF_COMPLIANCE,
                state: ApplicationVerificationRequirementState.PENDING,
                requirementKey: 'tier-3:independent-compliance-approval',
              },
            ],
          });

          const persisted = await tx.applicationVerificationSnapshot.findUniqueOrThrow({
            where: { id: snapshot.id },
            include: { subjects: true, requirements: true },
          });
          return receiptFromExisting(persisted, binding.id, false);
        }, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 20_000,
        });
      } catch (error) {
        if (error instanceof HttpException) throw error;
        if (isPrismaConflict(error) && attempt + 1 < MAX_SERIALIZATION_RETRIES) continue;
        if (isPrismaConflict(error)) throw conflict();
        throw error;
      }
    }
    throw conflict();
  }
}

export interface ApplicationVerificationSnapshotReceipt {
  snapshotId: string;
  generation: number;
  applicationId: string;
  accountKind: OnboardingApplicationKind;
  rulesetVersionId: string;
  bindingId: string;
  subjectCount: number;
  resolvedSubjectCount: number;
  unresolvedSubjectCount: number;
  requirementCount: number;
  pendingRequirementCount: number;
  unresolvedRequirementCount: number;
  tiers: Record<ApplicationVerificationRequirementStage, {
    requirementCount: number;
    pendingCount: number;
    unresolvedCount: number;
    state: 'NOT_ASSESSED' | 'BLOCKED' | 'INCOMPLETE';
  }>;
  submissionEligible: false;
  idempotentReplay: boolean;
}

type BoundRulesetVersion = NonNullable<SnapshotApplication['rulesetBinding']>['rulesetVersion'];

function buildSubjectPlan(
  application: SnapshotApplication,
  definitions: BoundRulesetVersion['subjectDefinitions'],
): SubjectPlan[] {
  const plan: SubjectPlan[] = [];
  for (const definition of definitions) {
    const targetKind = definition.targetKind;
    if (!targetKind) {
      plan.push(unresolved(definition.id, null, VerificationResolutionIssue.LEGACY_SUBJECT_KIND_UNCLASSIFIED));
      continue;
    }
    switch (targetKind) {
      case VerificationSubjectTargetKind.INDIVIDUAL_APPLICANT:
        if (application.kind !== OnboardingApplicationKind.INDIVIDUAL) {
          plan.push(unresolved(definition.id, targetKind, VerificationResolutionIssue.SUBJECT_KIND_NOT_APPLICABLE));
        } else if (!application.ownerUserId) {
          plan.push(unresolved(definition.id, targetKind, VerificationResolutionIssue.MISSING_APPLICANT_IDENTITY));
        } else {
          plan.push(resolvedUser(definition.id, targetKind, application.ownerUserId));
        }
        break;
      case VerificationSubjectTargetKind.JOINT_ACCOUNT_MEMBER:
        if (application.kind !== OnboardingApplicationKind.JOINT) {
          plan.push(unresolved(definition.id, targetKind, VerificationResolutionIssue.SUBJECT_KIND_NOT_APPLICABLE));
        } else if (!application.jointOwner?.members.length) {
          plan.push(unresolved(definition.id, targetKind, VerificationResolutionIssue.NO_ACTIVE_JOINT_MEMBERS));
        } else {
          for (const member of application.jointOwner.members) {
            plan.push({
              subjectDefinitionId: definition.id,
              targetKind,
              resolutionState: VerificationSubjectResolutionState.RESOLVED,
              unresolvedIssue: null,
              resolvedUserId: member.userId,
              resolvedCorporateAccountId: null,
              sourceJointMembershipId: member.id,
            });
          }
        }
        break;
      case VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY:
        if (application.kind !== OnboardingApplicationKind.CORPORATE) {
          plan.push(unresolved(definition.id, targetKind, VerificationResolutionIssue.SUBJECT_KIND_NOT_APPLICABLE));
        } else if (!application.ownerCorporateAccountId) {
          plan.push(unresolved(definition.id, targetKind, VerificationResolutionIssue.SUBJECT_KIND_NOT_APPLICABLE));
        } else {
          plan.push({
            subjectDefinitionId: definition.id,
            targetKind,
            resolutionState: VerificationSubjectResolutionState.RESOLVED,
            unresolvedIssue: null,
            resolvedUserId: null,
            resolvedCorporateAccountId: application.ownerCorporateAccountId,
            sourceJointMembershipId: null,
          });
        }
        break;
      case VerificationSubjectTargetKind.CORPORATE_AUTHORIZED_REPRESENTATIVE:
      case VerificationSubjectTargetKind.CORPORATE_BENEFICIAL_OWNER:
        if (application.kind !== OnboardingApplicationKind.CORPORATE) {
          plan.push(unresolved(definition.id, targetKind, VerificationResolutionIssue.SUBJECT_KIND_NOT_APPLICABLE));
        } else {
          // No CorporateRelatedPerson/declaration source exists. Record the
          // ruleset-defined unresolved requirement without inventing a person.
          plan.push(unresolved(
            definition.id,
            targetKind,
            VerificationResolutionIssue.CORPORATE_PERSON_SOURCE_UNAVAILABLE,
          ));
        }
        break;
    }
  }
  return plan;
}

function unresolved(
  subjectDefinitionId: string,
  targetKind: VerificationSubjectTargetKind | null,
  issue: VerificationResolutionIssue,
): SubjectPlan {
  return {
    subjectDefinitionId,
    targetKind,
    resolutionState: VerificationSubjectResolutionState.UNRESOLVED,
    unresolvedIssue: issue,
    resolvedUserId: null,
    resolvedCorporateAccountId: null,
    sourceJointMembershipId: null,
  };
}

function resolvedUser(
  subjectDefinitionId: string,
  targetKind: VerificationSubjectTargetKind,
  userId: string,
): SubjectPlan {
  return {
    subjectDefinitionId,
    targetKind,
    resolutionState: VerificationSubjectResolutionState.RESOLVED,
    unresolvedIssue: null,
    resolvedUserId: userId,
    resolvedCorporateAccountId: null,
    sourceJointMembershipId: null,
  };
}

function subjectIdentityKey(subject: SubjectPlan): string {
  return [
    subject.resolutionState,
    subject.resolvedUserId ?? '-',
    subject.resolvedCorporateAccountId ?? '-',
    subject.sourceJointMembershipId ?? '-',
  ].join(':');
}

function existingSnapshotMatches(
  existing: {
    id: string;
    applicationId: string;
    bindingId: string;
    accountKind: OnboardingApplicationKind;
    rulesetVersionId: string;
    corporateDetailsVersion: number | null;
    jointMembershipVersion: number | null;
    subjects: Array<{
      subjectDefinitionId: string;
      targetKind: VerificationSubjectTargetKind | null;
      resolutionState: VerificationSubjectResolutionState;
      unresolvedIssue: VerificationResolutionIssue | null;
      resolvedUserId: string | null;
      resolvedCorporateAccountId: string | null;
      sourceJointMembershipId: string | null;
    }>;
  },
  application: SnapshotApplication,
  bindingId: string,
  versionId: string,
  plan: SubjectPlan[],
): boolean {
  if (
    existing.applicationId !== application.id || existing.bindingId !== bindingId ||
    existing.accountKind !== application.kind || existing.rulesetVersionId !== versionId ||
    existing.corporateDetailsVersion !== (application.kind === OnboardingApplicationKind.CORPORATE
      ? application.corporateDetails?.version ?? null
      : null) ||
    existing.jointMembershipVersion !== (application.kind === OnboardingApplicationKind.JOINT
      ? application.jointOwner?.membershipVersion ?? null
      : null)
  ) return false;
  const actual = existing.subjects.map((subject) => ({
    subjectDefinitionId: subject.subjectDefinitionId,
    targetKind: subject.targetKind,
    resolutionState: subject.resolutionState,
    unresolvedIssue: subject.unresolvedIssue,
    resolvedUserId: subject.resolvedUserId,
    resolvedCorporateAccountId: subject.resolvedCorporateAccountId,
    sourceJointMembershipId: subject.sourceJointMembershipId,
  })).sort(comparePlan);
  return JSON.stringify(actual) === JSON.stringify([...plan].sort(comparePlan));
}

function comparePlan(a: SubjectPlan, b: SubjectPlan): number {
  return [a.subjectDefinitionId, a.targetKind ?? '', subjectIdentityKey(a)].join('|')
    .localeCompare([b.subjectDefinitionId, b.targetKind ?? '', subjectIdentityKey(b)].join('|'));
}

function receiptFromExisting(
  snapshot: {
    id: string;
    generation: number;
    applicationId: string;
    accountKind: OnboardingApplicationKind;
    rulesetVersionId: string;
    subjects: Array<{ resolutionState: VerificationSubjectResolutionState }>;
    requirements: Array<{
      stage: ApplicationVerificationRequirementStage;
      state: ApplicationVerificationRequirementState;
    }>;
  },
  bindingId: string,
  idempotentReplay: boolean,
): ApplicationVerificationSnapshotReceipt {
  const stages = Object.values(ApplicationVerificationRequirementStage).reduce((result, stage) => {
    const rows = snapshot.requirements.filter((requirement) => requirement.stage === stage);
    const unresolvedCount = rows.filter((requirement) =>
      requirement.state === ApplicationVerificationRequirementState.UNRESOLVED,
    ).length;
    const pendingCount = rows.filter((requirement) =>
      requirement.state === ApplicationVerificationRequirementState.PENDING,
    ).length;
    result[stage] = {
      requirementCount: rows.length,
      pendingCount,
      unresolvedCount,
      state: rows.length === 0 ? 'NOT_ASSESSED' : unresolvedCount > 0 ? 'BLOCKED' : 'INCOMPLETE',
    };
    return result;
  }, {} as ApplicationVerificationSnapshotReceipt['tiers']);
  const pendingRequirementCount = snapshot.requirements.filter((r) =>
    r.state === ApplicationVerificationRequirementState.PENDING,
  ).length;
  const unresolvedRequirementCount = snapshot.requirements.length - pendingRequirementCount;
  return {
    snapshotId: snapshot.id,
    generation: snapshot.generation,
    applicationId: snapshot.applicationId,
    accountKind: snapshot.accountKind,
    rulesetVersionId: snapshot.rulesetVersionId,
    bindingId,
    subjectCount: snapshot.subjects.length,
    resolvedSubjectCount: snapshot.subjects.filter((s) => s.resolutionState === VerificationSubjectResolutionState.RESOLVED).length,
    unresolvedSubjectCount: snapshot.subjects.filter((s) => s.resolutionState === VerificationSubjectResolutionState.UNRESOLVED).length,
    requirementCount: snapshot.requirements.length,
    pendingRequirementCount,
    unresolvedRequirementCount,
    tiers: stages,
    // Requirement existence is not verification; C1.7 alone may enable submit.
    submissionEligible: false,
    idempotentReplay,
  };
}

function isCompletePublishedVersion(
  version: NonNullable<SnapshotApplication['rulesetBinding']>['rulesetVersion'],
): boolean {
  return version.subjectDefinitions.length > 0 && version.subjectDefinitions.every((subject) =>
    subject.checks.length > 0 && subject.checks.every((check) => check.acceptedEvidenceSources.length > 0),
  );
}

function isPrismaConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034');
}

function conflict(): HttpException {
  return new HttpException(CONFLICT, HttpStatus.CONFLICT);
}
