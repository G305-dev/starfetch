import { ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { OnboardingApplicationStatus, VerificationSubjectResolutionState } from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MonoLookupAdapter, MonoLookupResult } from '../../verification-providers/mono/mono-lookup.adapter';
import { CorporateTinEncryptionProvider, CORPORATE_TIN_ENCRYPTION_PROVIDER, encryptedCorporateTinFromColumns } from '../crypto/corporate-tin-encryption';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './corporate-application-access.service';
import { CorporateO2AvailabilityService } from './corporate-o2-availability.service';

/** Internal Corporate-only CAC/TIN entry point; TIN is transiently decrypted and never returned/logged. */
@Injectable()
export class CorporateMonoLookupVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: CorporateApplicantContextService,
    private readonly access: CorporateApplicationAccessService,
    private readonly availability: CorporateO2AvailabilityService,
    private readonly lookup: MonoLookupAdapter,
    @Inject(CORPORATE_TIN_ENCRYPTION_PROVIDER) private readonly tinEncryption: CorporateTinEncryptionProvider,
  ) {}

  async verify(
    principal: AuthPrincipal | null | undefined,
    input: {
      readonly corporateAccountId: string;
      readonly requirementId: string;
      readonly consentRecordId: string;
      readonly operationKey: string;
      readonly channel: 'tin' | 'cac';
    },
  ): Promise<MonoLookupResult> {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    const application = await this.access.requireInitiatorOwnedCorporateAccount(applicant, input.corporateAccountId);
    const editableStatuses: readonly OnboardingApplicationStatus[] = [OnboardingApplicationStatus.DRAFT, OnboardingApplicationStatus.INFO_REQUESTED];
    if (!editableStatuses.includes(application.status)) throw unavailable();
    const snapshot = await this.prisma.applicationVerificationSnapshot.findFirst({
      where: { applicationId: application.id },
      orderBy: { generation: 'desc' },
      include: { subjects: true },
    });
    const details = await this.prisma.corporateOnboardingDetails.findUnique({ where: { applicationId: application.id } });
    if (!snapshot || !details || snapshot.corporateDetailsVersion !== details.version) throw unavailable();
    const requirement = await this.prisma.applicationVerificationRequirement.findFirst({
      where: {
        id: input.requirementId,
        snapshotId: snapshot.id,
        requirementKind: 'VERIFICATION_CHECK',
        state: 'PENDING',
        unresolvedIssue: null,
      },
      include: {
        subject: true,
        sourceCheckDefinition: { include: { acceptedEvidenceSources: true } },
      },
    });
    if (!requirement || requirement.subject?.resolutionState !== VerificationSubjectResolutionState.RESOLVED ||
      requirement.subject.targetKind !== 'CORPORATE_LEGAL_ENTITY' ||
      requirement.subject.resolvedCorporateAccountId !== application.ownerCorporateAccountId ||
      !requirement.sourceCheckDefinition?.acceptedEvidenceSources.some((source) => source.evidenceSourceKey === 'mono_lookup')) {
      throw new ForbiddenException();
    }

    let identifier = details.rcNumber;
    let plaintext: Buffer | undefined;
    try {
      if (input.channel === 'tin') {
        this.availability.requireAvailable();
        const envelope = encryptedCorporateTinFromColumns(details);
        if (!envelope) throw unavailable();
        plaintext = await this.tinEncryption.decrypt(envelope, application.id);
        if (!plaintext.length) throw unavailable();
        identifier = plaintext.toString('utf8');
      } else if (input.channel !== 'cac') {
        throw unavailable();
      }
      return await this.lookup.verifyBusiness({
        applicationId: application.id,
        requirementId: requirement.id,
        subjectSnapshotId: requirement.subject.id,
        actorUserId: applicant.initiatingUserId,
        consentRecordId: input.consentRecordId,
        operationKey: input.operationKey,
        channel: input.channel,
        number: identifier,
        expectedCorporateName: details.institutionName,
        expectedRcNumber: details.rcNumber,
      });
    } catch {
      // No identifier, ciphertext, provider payload, exception text, or secret is surfaced or logged.
      return { status: 'UNAVAILABLE', evidenceId: null, reference: null, safeReason: 'LOOKUP_UNAVAILABLE', idempotentReplay: false };
    } finally {
      plaintext?.fill(0);
      identifier = '';
    }
  }
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Corporate verification is not configured.' });
}
