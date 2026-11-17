import { createHash } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnboardingApplicationKind, Prisma, UserRole, VerificationConsentEventKind } from '@prisma/client';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MonoProveAuthorizationRequest, ApprovedMonoProveConsent, MonoProveConsentAuthorizer } from './mono/mono-verification-ports';
import { VerificationOperationKeyring, VersionedVerificationDigest, VERIFICATION_OPERATION_KEYRING, verificationOperationDigests } from './verification-operation-keyring';

export type ConsentProvider = 'mono_prove' | 'mono_lookup';
export type ConsentIdentityKind = 'bvn' | 'nin' | 'tin' | 'cac';

export interface ConsentReceipt {
  readonly consentRecordId: string;
  readonly applicationId: string;
  readonly providerKey: ConsentProvider;
  readonly eventKind: VerificationConsentEventKind;
  readonly consentTextVersion: string;
  readonly privacyNoticeVersion: string;
  readonly lawfulBasisVersion: string;
  readonly allowedIdentityKinds: readonly ConsentIdentityKind[];
  readonly idempotentReplay: boolean;
}

interface ConsentPolicy {
  readonly enabled: boolean;
  readonly environment?: string;
  readonly lawfulBasisApproved: boolean;
  readonly privacyNoticeApproved: boolean;
  readonly consentTextApproved: boolean;
  readonly consentTextVersion?: string;
  readonly privacyNoticeVersion?: string;
  readonly lawfulBasisVersion?: string;
  readonly consentTextSha256?: string;
}

const ALLOWED_IDENTITIES: Readonly<Record<ConsentProvider, readonly ConsentIdentityKind[]>> = {
  mono_prove: ['bvn', 'nin'],
  mono_lookup: ['tin', 'cac'],
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_VERSION = /^[A-Za-z0-9._-]{1,64}$/;
const HASH = /^[0-9a-f]{64}$/;

/**
 * Durable consent ledger and Mono Prove consent authorizer. This service has
 * no public controller: callers must add a D-06-approved API before exposing
 * consent capture. Feature/policy config is mandatory and defaults to deny.
 */
@Injectable()
export class VerificationConsentService implements MonoProveConsentAuthorizer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(VERIFICATION_OPERATION_KEYRING) private readonly keyring: VerificationOperationKeyring,
  ) {}

  async recordGrant(
    principal: AuthPrincipal | null | undefined,
    input: {
      readonly applicationId: string;
      readonly providerKey: ConsentProvider;
      readonly operationKey: string;
      readonly allowedIdentityKinds: readonly ConsentIdentityKind[];
    },
  ): Promise<ConsentReceipt> {
    const actorUserId = await this.requireInvestorPrincipal(principal);
    const policy = this.requireApprovedPolicy(input.providerKey);
    if (!UUID.test(input.applicationId) || !validIdentityKinds(input.providerKey, input.allowedIdentityKinds)) throw badRequest();
    const digests = verificationOperationDigests(
      this.keyring,
      'consent-operation',
      { applicationId: input.applicationId, actorUserId, providerKey: input.providerKey },
      input.operationKey,
    );
    const digest = requireActiveDigest(digests, this.keyring.activeVersion);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "onboarding_applications" WHERE "id" = ${input.applicationId}::uuid FOR UPDATE
      `;
      await this.requireApplicantScope(tx, actorUserId, input.applicationId);
      const existing = await tx.verificationConsentEvent.findFirst({
        where: {
          applicationId: input.applicationId,
          actorUserId,
          providerKey: input.providerKey,
          operationKeyDigest: { in: digests.map((item) => item.digest) },
        },
      });
      if (existing) return receipt(existing, true);
      const current = await tx.verificationConsentEvent.findFirst({
        where: { applicationId: input.applicationId, actorUserId, providerKey: input.providerKey },
        orderBy: { sequence: 'desc' },
      });
      if (current?.eventKind === VerificationConsentEventKind.GRANTED) throw new ConflictException('Consent is already active.');

      const created = await tx.verificationConsentEvent.create({
        data: {
          applicationId: input.applicationId,
          actorUserId,
          providerKey: input.providerKey,
          eventKind: VerificationConsentEventKind.GRANTED,
          consentTextVersion: policy.consentTextVersion!,
          privacyNoticeVersion: policy.privacyNoticeVersion!,
          lawfulBasisVersion: policy.lawfulBasisVersion!,
          consentTextSha256: policy.consentTextSha256!,
          allowedIdentityKinds: [...input.allowedIdentityKinds],
          operationKeyDigest: digest.digest,
          hmacKeyVersion: digest.keyVersion,
        },
      });
      return receipt(created, false);
    }, { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 10_000 });
  }

  async withdraw(
    principal: AuthPrincipal | null | undefined,
    input: { readonly applicationId: string; readonly providerKey: ConsentProvider; readonly operationKey: string },
  ): Promise<ConsentReceipt> {
    const actorUserId = await this.requireInvestorPrincipal(principal);
    if (!UUID.test(input.applicationId)) throw badRequest();
    const digests = verificationOperationDigests(
      this.keyring,
      'consent-operation',
      { applicationId: input.applicationId, actorUserId, providerKey: input.providerKey },
      input.operationKey,
    );
    const digest = requireActiveDigest(digests, this.keyring.activeVersion);

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "onboarding_applications" WHERE "id" = ${input.applicationId}::uuid FOR UPDATE
      `;
      await this.requireApplicantScope(tx, actorUserId, input.applicationId);
      const existing = await tx.verificationConsentEvent.findFirst({
        where: {
          applicationId: input.applicationId,
          actorUserId,
          providerKey: input.providerKey,
          operationKeyDigest: { in: digests.map((item) => item.digest) },
        },
      });
      if (existing) return receipt(existing, true);
      const current = await tx.verificationConsentEvent.findFirst({
        where: { applicationId: input.applicationId, actorUserId, providerKey: input.providerKey },
        orderBy: { sequence: 'desc' },
      });
      if (!current || current.eventKind !== VerificationConsentEventKind.GRANTED) throw new ConflictException('No active consent exists.');
      const created = await tx.verificationConsentEvent.create({
        data: {
          applicationId: input.applicationId,
          actorUserId,
          providerKey: input.providerKey,
          eventKind: VerificationConsentEventKind.WITHDRAWN,
          consentTextVersion: current.consentTextVersion,
          privacyNoticeVersion: current.privacyNoticeVersion,
          lawfulBasisVersion: current.lawfulBasisVersion,
          consentTextSha256: current.consentTextSha256,
          allowedIdentityKinds: current.allowedIdentityKinds,
          operationKeyDigest: digest.digest,
          hmacKeyVersion: digest.keyVersion,
        },
      });
      return receipt(created, false);
    }, { isolationLevel: 'Serializable', maxWait: 5_000, timeout: 10_000 });
  }

  async requireApprovedConsent(input: MonoProveAuthorizationRequest): Promise<ApprovedMonoProveConsent> {
    const policy = this.requireApprovedPolicy('mono_prove');
    if (input.actorUserId !== input.subjectUserId || !UUID.test(input.applicationId) || !UUID.test(input.consentRecordId) ||
      !UUID.test(input.subjectUserId) || !UUID.test(input.requirementId) || !validIdentityKinds('mono_prove', input.identities as ConsentIdentityKind[])) {
      throw unavailableConsent();
    }
    const application = await this.prisma.onboardingApplication.findFirst({
      where: {
        id: input.applicationId,
        OR: [
          { kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: input.subjectUserId },
          { kind: OnboardingApplicationKind.JOINT, jointOwner: { members: { some: { userId: input.subjectUserId } } } },
        ],
      },
      select: { id: true },
    });
    if (!application) throw unavailableConsent();
    const [consent, latest] = await Promise.all([
      this.prisma.verificationConsentEvent.findFirst({
        where: { id: input.consentRecordId, applicationId: input.applicationId, actorUserId: input.actorUserId, providerKey: 'mono_prove' },
      }),
      this.prisma.verificationConsentEvent.findFirst({
        where: { applicationId: input.applicationId, actorUserId: input.actorUserId, providerKey: 'mono_prove' },
        orderBy: { sequence: 'desc' },
      }),
    ]);
    if (!consent || consent.id !== latest?.id || consent.eventKind !== VerificationConsentEventKind.GRANTED ||
      consent.consentTextVersion !== policy.consentTextVersion || consent.privacyNoticeVersion !== policy.privacyNoticeVersion ||
      consent.lawfulBasisVersion !== policy.lawfulBasisVersion || consent.consentTextSha256 !== policy.consentTextSha256 ||
      input.identities.some((identity) => !consent.allowedIdentityKinds.includes(identity))) {
      throw unavailableConsent();
    }
    return {
      applicationId: consent.applicationId,
      subjectUserId: input.subjectUserId,
      consentRecordId: consent.id,
      textVersion: consent.consentTextVersion,
      privacyNoticeVersion: consent.privacyNoticeVersion,
      lawfulBasisVersion: consent.lawfulBasisVersion,
      allowedIdentities: consent.allowedIdentityKinds,
    };
  }

  async requireApprovedLookupConsent(input: {
    readonly applicationId: string;
    readonly actorUserId: string;
    readonly consentRecordId: string;
    readonly identityKind: 'tin' | 'cac';
  }): Promise<ConsentReceipt> {
    const policy = this.requireApprovedPolicy('mono_lookup');
    if (!UUID.test(input.applicationId) || !UUID.test(input.actorUserId) || !UUID.test(input.consentRecordId)) throw unavailableConsent();
    const application = await this.prisma.onboardingApplication.findFirst({
      where: { id: input.applicationId, kind: OnboardingApplicationKind.CORPORATE, initiatingUserId: input.actorUserId },
      select: { id: true },
    });
    if (!application) throw unavailableConsent();
    const [consent, latest] = await Promise.all([
      this.prisma.verificationConsentEvent.findFirst({
        where: { id: input.consentRecordId, applicationId: input.applicationId, actorUserId: input.actorUserId, providerKey: 'mono_lookup' },
      }),
      this.prisma.verificationConsentEvent.findFirst({
        where: { applicationId: input.applicationId, actorUserId: input.actorUserId, providerKey: 'mono_lookup' },
        orderBy: { sequence: 'desc' },
      }),
    ]);
    if (!consent || consent.id !== latest?.id || consent.eventKind !== VerificationConsentEventKind.GRANTED ||
      consent.consentTextVersion !== policy.consentTextVersion || consent.privacyNoticeVersion !== policy.privacyNoticeVersion ||
      consent.lawfulBasisVersion !== policy.lawfulBasisVersion || consent.consentTextSha256 !== policy.consentTextSha256 ||
      !consent.allowedIdentityKinds.includes(input.identityKind)) throw unavailableConsent();
    return receipt(consent, false);
  }

  private async requireInvestorPrincipal(principal: AuthPrincipal | null | undefined): Promise<string> {
    if (!principal || !UUID.test(principal.userId) || !principal.sessionId || principal.role !== UserRole.INVESTOR) throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: principal.userId }, select: { id: true, role: true, emailVerifiedAt: true } });
    if (!user || user.role !== UserRole.INVESTOR || !user.emailVerifiedAt) throw new ForbiddenException();
    return user.id;
  }

  private async requireApplicantScope(tx: Prisma.TransactionClient, userId: string, applicationId: string): Promise<void> {
    const application = await tx.onboardingApplication.findFirst({
      where: {
        id: applicationId,
        OR: [
          { initiatingUserId: userId },
          { kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: userId },
          { kind: OnboardingApplicationKind.JOINT, jointOwner: { members: { some: { userId } } } },
        ],
      },
      select: { id: true },
    });
    if (!application) throw new ForbiddenException();
  }

  private requireApprovedPolicy(provider: ConsentProvider): ConsentPolicy & {
    consentTextVersion: string; privacyNoticeVersion: string; lawfulBasisVersion: string; consentTextSha256: string;
  } {
    const settings = provider === 'mono_prove'
      ? this.config.get<ConsentPolicy>('corporate.mono')
      : this.config.get<ConsentPolicy>('corporate.monoLookup');
    if (!settings?.enabled || settings.environment !== 'sandbox' || !settings.lawfulBasisApproved || !settings.privacyNoticeApproved ||
      !settings.consentTextApproved || !SAFE_VERSION.test(settings.consentTextVersion ?? '') ||
      !SAFE_VERSION.test(settings.privacyNoticeVersion ?? '') || !SAFE_VERSION.test(settings.lawfulBasisVersion ?? '') ||
      !HASH.test(settings.consentTextSha256 ?? '')) throw unavailableConsent();
    return settings as ConsentPolicy & { consentTextVersion: string; privacyNoticeVersion: string; lawfulBasisVersion: string; consentTextSha256: string };
  }
}

function validIdentityKinds(provider: ConsentProvider, values: readonly string[]): values is readonly ConsentIdentityKind[] {
  return Array.isArray(values) && values.length > 0 && values.length <= 2 &&
    new Set(values).size === values.length && values.every((value) => ALLOWED_IDENTITIES[provider].includes(value as ConsentIdentityKind));
}

function requireActiveDigest(digests: readonly VersionedVerificationDigest[], version: string): VersionedVerificationDigest {
  const active = digests.find((candidate) => candidate.keyVersion === version);
  if (!active) throw new ServiceUnavailableException('Verification operation key is unavailable.');
  return active;
}

function receipt(event: {
  id: string; applicationId: string; providerKey: string; eventKind: VerificationConsentEventKind;
  consentTextVersion: string; privacyNoticeVersion: string; lawfulBasisVersion: string; allowedIdentityKinds: string[];
}, idempotentReplay: boolean): ConsentReceipt {
  return {
    consentRecordId: event.id,
    applicationId: event.applicationId,
    providerKey: event.providerKey as ConsentProvider,
    eventKind: event.eventKind,
    consentTextVersion: event.consentTextVersion,
    privacyNoticeVersion: event.privacyNoticeVersion,
    lawfulBasisVersion: event.lawfulBasisVersion,
    allowedIdentityKinds: event.allowedIdentityKinds as ConsentIdentityKind[],
    idempotentReplay,
  };
}

function unavailableConsent(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Approved verification consent is not configured.' });
}

function badRequest(): BadRequestException {
  // Generic and non-reflective; malformed caller content never reaches logs or responses.
  return new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Invalid verification consent request.' });
}

export function approvedConsentTextHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
