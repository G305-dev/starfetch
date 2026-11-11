import { randomUUID } from 'crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, ProviderVerificationEvidenceStatus, VerificationConsentEventKind } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { VerificationOperationKeyring, VERIFICATION_OPERATION_KEYRING, verificationOperationDigests } from '../verification-operation-keyring';
import {
  MonoEvidenceAppend,
  MonoEvidenceJournal,
  MonoEvidenceReservation,
  MonoEvidenceStatus,
  MonoWebhookEvidenceAppend,
} from './mono-verification-ports';

const PROVIDER_KEY = 'mono_prove';
const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * PostgreSQL implementation of the Prove consent-linked attempt journal.
 * It stores no identity numbers, customer payloads, redirect URLs, or secrets.
 */
@Injectable()
export class PrismaMonoEvidenceJournal implements MonoEvidenceJournal {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VERIFICATION_OPERATION_KEYRING) private readonly keyring: VerificationOperationKeyring,
  ) {}

  async reserve(input: Parameters<MonoEvidenceJournal['reserve']>[0]): Promise<MonoEvidenceReservation> {
    const digests = verificationOperationDigests(
      this.keyring,
      'provider-operation',
      {
        applicationId: input.applicationId,
        requirementId: input.requirementId,
        actorUserId: input.actorUserId,
        subjectUserId: input.subjectUserId,
        providerKey: PROVIDER_KEY,
      },
      input.operationKey,
    );
    const activeDigest = digests.find((digest) => digest.keyVersion === this.keyring.activeVersion);
    if (!activeDigest) throw unavailable();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const consent = await tx.verificationConsentEvent.findFirst({
          where: {
            id: input.consentRecordId,
            applicationId: input.applicationId,
            actorUserId: input.actorUserId,
            providerKey: PROVIDER_KEY,
            eventKind: VerificationConsentEventKind.GRANTED,
          },
        });
        const latestConsent = await tx.verificationConsentEvent.findFirst({
          where: { applicationId: input.applicationId, actorUserId: input.actorUserId, providerKey: PROVIDER_KEY },
          orderBy: { sequence: 'desc' },
        });
        if (!consent || consent.id !== latestConsent?.id || consent.id !== input.consentRecordId) throw unavailable();

        const requirement = await tx.applicationVerificationRequirement.findFirst({
          where: {
            id: input.requirementId,
            requirementKind: 'VERIFICATION_CHECK',
            snapshot: { applicationId: input.applicationId },
          },
          include: { subject: true, sourceCheckDefinition: { include: { acceptedEvidenceSources: true } } },
        });
        if (!requirement?.sourceCheckDefinition?.acceptedEvidenceSources.some((source) => source.evidenceSourceKey === PROVIDER_KEY)) {
          throw unavailable();
        }
        if (!requirement.subject || requirement.subject.resolutionState !== 'RESOLVED' ||
          requirement.subject.resolvedUserId !== input.subjectUserId) throw unavailable();
        const user = await tx.user.findUnique({ where: { id: input.subjectUserId }, select: { role: true, emailVerifiedAt: true } });
        if (!user || user.role !== 'INVESTOR' || !user.emailVerifiedAt) throw unavailable();

        const existing = await tx.providerVerificationAttempt.findFirst({
          where: { providerKey: PROVIDER_KEY, operationKeyDigest: { in: digests.map((digest) => digest.digest) } },
          include: { events: { orderBy: { sequence: 'desc' }, take: 1 } },
        });
        if (existing) {
          if (existing.applicationId !== input.applicationId || existing.requirementId !== input.requirementId ||
            existing.actorUserId !== input.actorUserId || existing.subjectUserId !== input.subjectUserId ||
            existing.consentEventId !== input.consentRecordId) throw unavailable();
          const latest = existing.events[0];
          return {
            evidenceId: existing.id,
            reference: existing.reference,
            shouldInitiate: false,
            existingStatus: latest?.status as MonoEvidenceStatus | undefined ?? 'UNAVAILABLE',
            providerSessionId: latest?.providerSessionId ?? undefined,
            // Redirect URLs are not persisted as they are bearer-like provider session capabilities.
          };
        }

        const attempt = await tx.providerVerificationAttempt.create({
          data: {
            applicationId: input.applicationId,
            requirementId: input.requirementId,
            subjectSnapshotId: requirement.subjectSnapshotId,
            subjectUserId: input.subjectUserId,
            actorUserId: input.actorUserId,
            consentEventId: input.consentRecordId,
            providerKey: PROVIDER_KEY,
            reference: `sf-${randomUUID()}`,
            operationKeyDigest: activeDigest.digest,
            hmacKeyVersion: activeDigest.keyVersion,
            identityKinds: [...input.identities],
          },
        });
        return { evidenceId: attempt.id, reference: attempt.reference, shouldInitiate: true };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.providerVerificationAttempt.findFirst({
          where: { providerKey: PROVIDER_KEY, operationKeyDigest: { in: digests.map((digest) => digest.digest) } },
          include: { events: { orderBy: { sequence: 'desc' }, take: 1 } },
        });
        if (existing && existing.applicationId === input.applicationId && existing.requirementId === input.requirementId &&
          existing.actorUserId === input.actorUserId && existing.subjectUserId === input.subjectUserId &&
          existing.consentEventId === input.consentRecordId) {
          const latest = existing.events[0];
          return {
            evidenceId: existing.id,
            reference: existing.reference,
            shouldInitiate: false,
            existingStatus: latest?.status as MonoEvidenceStatus | undefined ?? 'UNAVAILABLE',
            providerSessionId: latest?.providerSessionId ?? undefined,
          };
        }
      }
      throw error;
    }
  }

  async append(input: MonoEvidenceAppend): Promise<void> {
    if (!HEX_64.test(input.rawPayloadSha256 ?? '') && input.rawPayloadSha256 !== null) throw unavailable();
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.providerVerificationAttempt.findFirst({
        where: {
          id: input.evidenceId,
          applicationId: input.applicationId,
          requirementId: input.requirementId,
          providerKey: input.providerKey,
          reference: input.providerReference,
        },
      });
      if (!attempt) throw unavailable();
      await tx.providerVerificationEvidenceEvent.create({
        data: {
          attemptId: attempt.id,
          providerKey: input.providerKey,
          providerReference: input.providerReference,
          providerSessionId: input.providerSessionId,
          status: input.status as ProviderVerificationEvidenceStatus,
          rawPayloadSha256: input.rawPayloadSha256,
          safeReason: safeReason(input.safeReason),
          occurredAt: input.occurredAt,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
  }

  async appendWebhook(input: MonoWebhookEvidenceAppend): Promise<boolean> {
    if (!HEX_64.test(input.replayDigest)) throw unavailable();
    try {
      await this.prisma.$transaction(async (tx) => {
        const attempt = await tx.providerVerificationAttempt.findFirst({
          where: {
            providerKey: input.providerKey,
            reference: input.providerReference,
            events: { some: { providerSessionId: input.providerSessionId } },
          },
        });
        if (!attempt) throw unavailable();
        await tx.providerVerificationEvidenceEvent.create({
          data: {
            attemptId: attempt.id,
            providerKey: input.providerKey,
            providerEventId: input.providerEventId,
            replayDigest: input.replayDigest,
            providerSessionId: input.providerSessionId,
            providerReference: input.providerReference,
            status: input.status as ProviderVerificationEvidenceStatus,
            occurredAt: input.occurredAt,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
      return true;
    } catch (error) {
      if (isUniqueConflict(error)) {
        const existing = await this.prisma.providerVerificationEvidenceEvent.findUnique({ where: { replayDigest: input.replayDigest }, select: { id: true } });
        if (existing) return false;
      }
      throw error;
    }
  }
}

function safeReason(reason: string | null): string | null {
  if (!reason) return null;
  return /^[A-Z0-9_]{1,80}$/.test(reason) ? reason : 'UNAVAILABLE';
}

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Provider evidence infrastructure is unavailable.' });
}
