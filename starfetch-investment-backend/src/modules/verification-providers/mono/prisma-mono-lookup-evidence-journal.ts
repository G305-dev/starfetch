import { randomUUID } from 'crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OnboardingApplicationKind, OnboardingApplicationStatus, Prisma, ProviderVerificationEvidenceStatus, UserRole, VerificationConsentEventKind } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { VERIFICATION_OPERATION_KEYRING, VerificationOperationKeyring, verificationOperationDigests } from '../verification-operation-keyring';
import { MonoEvidenceStatus } from './mono-verification-ports';
import { MonoLookupEvidenceJournal, MonoLookupReservation } from './mono-lookup-ports';

const PROVIDER_KEY = 'mono_lookup';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;

/** Persists sanitized CAC/TIN lookup evidence to the shared append-only journal. */
@Injectable()
export class PrismaMonoLookupEvidenceJournal implements MonoLookupEvidenceJournal {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VERIFICATION_OPERATION_KEYRING) private readonly keyring: VerificationOperationKeyring,
  ) {}

  async reserve(input: Parameters<MonoLookupEvidenceJournal['reserve']>[0]): Promise<MonoLookupReservation> {
    if (!UUID.test(input.subjectSnapshotId)) throw unavailable();
    const digests = verificationOperationDigests(
      this.keyring,
      'provider-operation',
      { applicationId: input.applicationId, requirementId: input.requirementId, actorUserId: input.actorUserId, providerKey: PROVIDER_KEY },
      input.operationKey,
    );
    const activeDigest = digests.find((candidate) => candidate.keyVersion === this.keyring.activeVersion);
    if (!activeDigest) throw unavailable();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const app = await tx.onboardingApplication.findFirst({
          where: {
            id: input.applicationId,
            kind: OnboardingApplicationKind.CORPORATE,
            initiatingUserId: input.actorUserId,
            status: { in: [OnboardingApplicationStatus.DRAFT, OnboardingApplicationStatus.INFO_REQUESTED] },
          },
          include: {
            corporateDetails: { select: { version: true } },
            verificationSnapshots: { orderBy: { generation: 'desc' }, take: 1, select: { id: true, corporateDetailsVersion: true } },
          },
        });
        if (!app || !app.corporateDetails || app.verificationSnapshots[0]?.corporateDetailsVersion !== app.corporateDetails.version) throw unavailable();
        const consent = await tx.verificationConsentEvent.findFirst({
          where: {
            id: input.consentRecordId,
            applicationId: input.applicationId,
            actorUserId: input.actorUserId,
            providerKey: PROVIDER_KEY,
            eventKind: VerificationConsentEventKind.GRANTED,
            consentTextVersion: input.consentTextVersion,
            allowedIdentityKinds: { has: input.identityKind },
          },
        });
        const latestConsent = await tx.verificationConsentEvent.findFirst({
          where: { applicationId: input.applicationId, actorUserId: input.actorUserId, providerKey: PROVIDER_KEY },
          orderBy: { sequence: 'desc' },
        });
        if (!consent || consent.id !== latestConsent?.id) throw unavailable();

        const requirement = await tx.applicationVerificationRequirement.findFirst({
          where: {
            id: input.requirementId,
            snapshotId: app.verificationSnapshots[0].id,
            requirementKind: 'VERIFICATION_CHECK',
          },
          include: {
            subject: true,
            sourceCheckDefinition: { include: { acceptedEvidenceSources: true } },
          },
        });
        if (!requirement || requirement.subjectSnapshotId !== input.subjectSnapshotId ||
          requirement.subject?.resolutionState !== 'RESOLVED' ||
          requirement.subject.targetKind !== 'CORPORATE_LEGAL_ENTITY' ||
          requirement.subject.resolvedCorporateAccountId !== app.ownerCorporateAccountId ||
          !requirement.sourceCheckDefinition?.acceptedEvidenceSources.some((source) => source.evidenceSourceKey === PROVIDER_KEY)) {
          throw unavailable();
        }
        const actor = await tx.user.findUnique({ where: { id: input.actorUserId }, select: { role: true, emailVerifiedAt: true } });
        if (!actor || actor.role !== UserRole.INVESTOR || !actor.emailVerifiedAt) throw unavailable();

        const existing = await tx.providerVerificationAttempt.findFirst({
          where: { providerKey: PROVIDER_KEY, operationKeyDigest: { in: digests.map((candidate) => candidate.digest) } },
          include: { events: { orderBy: { sequence: 'desc' }, take: 1 } },
        });
        if (existing) {
          if (existing.applicationId !== input.applicationId || existing.requirementId !== input.requirementId ||
            existing.actorUserId !== input.actorUserId || existing.subjectSnapshotId !== input.subjectSnapshotId ||
            existing.consentEventId !== input.consentRecordId) throw unavailable();
          return {
            evidenceId: existing.id,
            reference: existing.reference,
            shouldLookup: false,
            existingStatus: (existing.events[0]?.status as MonoEvidenceStatus | undefined) ?? 'UNAVAILABLE',
          };
        }
        const created = await tx.providerVerificationAttempt.create({
          data: {
            applicationId: input.applicationId,
            requirementId: input.requirementId,
            subjectSnapshotId: input.subjectSnapshotId,
            actorUserId: input.actorUserId,
            consentEventId: input.consentRecordId,
            providerKey: PROVIDER_KEY,
            reference: `sf-${randomUUID()}`,
            operationKeyDigest: activeDigest.digest,
            hmacKeyVersion: activeDigest.keyVersion,
            identityKinds: [input.identityKind],
          },
        });
        return { evidenceId: created.id, reference: created.reference, shouldLookup: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.providerVerificationAttempt.findFirst({
          where: { providerKey: PROVIDER_KEY, operationKeyDigest: { in: digests.map((candidate) => candidate.digest) } },
          include: { events: { orderBy: { sequence: 'desc' }, take: 1 } },
        });
        if (existing && existing.applicationId === input.applicationId && existing.requirementId === input.requirementId &&
          existing.actorUserId === input.actorUserId && existing.subjectSnapshotId === input.subjectSnapshotId &&
          existing.consentEventId === input.consentRecordId) {
          return {
            evidenceId: existing.id,
            reference: existing.reference,
            shouldLookup: false,
            existingStatus: (existing.events[0]?.status as MonoEvidenceStatus | undefined) ?? 'UNAVAILABLE',
          };
        }
      }
      throw error;
    }
  }

  async append(input: Parameters<MonoLookupEvidenceJournal['append']>[0]): Promise<void> {
    if (input.rawPayloadSha256 !== null && !HASH.test(input.rawPayloadSha256)) throw unavailable();
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.providerVerificationAttempt.findFirst({
        where: {
          id: input.evidenceId,
          applicationId: input.applicationId,
          requirementId: input.requirementId,
          reference: input.reference,
          providerKey: PROVIDER_KEY,
        },
        select: { id: true },
      });
      if (!attempt) throw unavailable();
      await tx.providerVerificationEvidenceEvent.create({
        data: {
          attemptId: attempt.id,
          providerKey: PROVIDER_KEY,
          providerReference: input.reference,
          status: input.status as ProviderVerificationEvidenceStatus,
          rawPayloadSha256: input.rawPayloadSha256,
          safeReason: safeReason(input.safeReason),
          occurredAt: input.occurredAt,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
  }
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function safeReason(reason: string | null): string | null {
  return reason && /^[A-Z0-9_]{1,80}$/.test(reason) ? reason : reason ? 'UNAVAILABLE' : null;
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Mono Lookup evidence infrastructure is unavailable.' });
}
