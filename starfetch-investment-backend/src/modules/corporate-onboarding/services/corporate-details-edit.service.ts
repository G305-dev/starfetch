import { Inject, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OnboardingApplicationStatus, Prisma } from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CORPORATE_TIN_ENCRYPTION_PROVIDER,
  CorporateTinEncryptionProvider,
} from '../crypto/corporate-tin-encryption';
import { CorporateDetailsUpdateInput, canonicalizeCorporateDetailsPatch } from '../dto/corporate-details-update.input';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './corporate-application-access.service';
import { CorporateO2AvailabilityService } from './corporate-o2-availability.service';
import { CorporateTinReadService } from './corporate-tin-read.service';

export const CORPORATE_DETAILS_EDITABLE_STATES = [
  OnboardingApplicationStatus.DRAFT,
  OnboardingApplicationStatus.INFO_REQUESTED,
] as const;

export interface CorporateDetailsUpdateResult {
  readonly applicationId: string;
  readonly corporateAccountId: string;
  readonly status: OnboardingApplicationStatus;
  readonly details: {
    readonly institutionName: string;
    readonly dateOfIncorporation: string;
    readonly rcNumber: string;
    readonly businessPhoneNumber: string;
    readonly businessEmail: string;
    readonly taxIdentificationNumberMasked: string | null;
    readonly version: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = {
  code: ERROR_CODES.NOT_FOUND,
  message: 'Application not found.',
} as const;
const VERSION_CONFLICT = {
  code: ERROR_CODES.CONFLICT,
  message: 'Corporate details have changed. Reload the application and retry with the current version.',
} as const;

/**
 * Owner-scoped optimistic update for the one canonical Corporate details row.
 * Every successful amendment appends a versioned before/after record in the
 * same transaction; sensitive TIN values in history are encrypted envelopes.
 */
@Injectable()
export class CorporateDetailsEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: CorporateApplicantContextService,
    private readonly access: CorporateApplicationAccessService,
    @Inject(CORPORATE_TIN_ENCRYPTION_PROVIDER)
    private readonly encryption: CorporateTinEncryptionProvider,
    private readonly availability: CorporateO2AvailabilityService,
    private readonly tinRead: CorporateTinReadService,
  ) {}

  async updateByCorporateAccountId(
    principal: AuthPrincipal | null | undefined,
    corporateAccountId: string,
    expectedVersion: number,
    input: CorporateDetailsUpdateInput,
  ): Promise<CorporateDetailsUpdateResult> {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    const application = await this.access.requireInitiatorOwnedCorporateAccount(applicant, corporateAccountId);
    return this.updateDetails(principal, application.id, expectedVersion, input);
  }

  /** Internal application-ID entry point retained for trusted backend callers. */
  async updateDetails(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
    expectedVersion: number,
    input: CorporateDetailsUpdateInput,
  ): Promise<CorporateDetailsUpdateResult> {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    if (!UUID_PATTERN.test(applicationId)) {
      throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_FAILED, message: 'A positive expected details version is required.' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const patch = canonicalizeCorporateDetailsPatch(input);
    const taxIdentificationNumber = patch.taxIdentificationNumber;
    if (taxIdentificationNumber !== undefined) this.availability.requireAvailable();
    const nonSensitivePatch = { ...patch };
    delete nonSensitivePatch.taxIdentificationNumber;

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const application = await tx.onboardingApplication.findFirst({
            where: {
              id: applicationId,
              kind: 'CORPORATE',
              initiatingUserId: applicant.initiatingUserId,
              ownerCorporateAccountId: { not: null },
            },
            select: { id: true, status: true, ownerCorporateAccountId: true },
          });
          if (!application || !application.ownerCorporateAccountId) {
            throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
          }
          this.access.requireApplicationState(application, CORPORATE_DETAILS_EDITABLE_STATES);

          const before = await tx.corporateOnboardingDetails.findUnique({
            where: { applicationId: application.id },
          });
          if (!before) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
          if (before.version !== expectedVersion) throw new HttpException(VERSION_CONFLICT, HttpStatus.CONFLICT);

          let encryptedPatch: Prisma.CorporateOnboardingDetailsUpdateManyMutationInput = {};
          if (taxIdentificationNumber !== undefined) {
            const envelope = await this.encryption.encrypt(taxIdentificationNumber, application.id);
            encryptedPatch = {
              taxIdentificationNumberCiphertext: envelope.ciphertext,
              taxIdentificationNumberIv: envelope.iv,
              taxIdentificationNumberAuthTag: envelope.authTag,
              taxIdentificationNumberEncryptedDataKey: envelope.encryptedDataKey,
              taxIdentificationNumberKeyProvider: envelope.keyProvider,
              taxIdentificationNumberKeyId: envelope.keyId,
              taxIdentificationNumberKeyVersion: envelope.keyVersion,
              taxIdentificationNumberContextVersion: envelope.contextVersion,
            };
          }

          const changed = await tx.corporateOnboardingDetails.updateMany({
            where: { applicationId: application.id, version: expectedVersion },
            data: { ...nonSensitivePatch, ...encryptedPatch, version: { increment: 1 } },
          });
          if (changed.count !== 1) throw new HttpException(VERSION_CONFLICT, HttpStatus.CONFLICT);

          const after = await tx.corporateOnboardingDetails.findUnique({
            where: { applicationId: application.id },
          });
          if (!after) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
          await tx.corporateDetailsRevision.create({
            data: {
              applicationId: application.id,
              version: after.version,
              changedByUserId: applicant.initiatingUserId,
              changedFieldNames: Object.keys(patch).sort(),
              beforeSnapshot: detailsSnapshot(before),
              afterSnapshot: detailsSnapshot(after),
            },
          });

          const taxIdentificationNumberMasked = await this.tinRead.maskedProjection(application.id, after);
          return {
            applicationId: application.id,
            corporateAccountId: application.ownerCorporateAccountId,
            status: application.status,
            details: {
              institutionName: after.institutionName,
              dateOfIncorporation: after.dateOfIncorporation.toISOString().slice(0, 10),
              rcNumber: after.rcNumber,
              businessPhoneNumber: after.businessPhoneNumber,
              businessEmail: after.businessEmail,
              taxIdentificationNumberMasked,
              version: after.version,
              createdAt: after.createdAt,
              updatedAt: after.updatedAt,
            },
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' || error.code === 'P2002')
      ) {
        throw new HttpException(VERSION_CONFLICT, HttpStatus.CONFLICT);
      }
      throw new HttpException(
        { code: ERROR_CODES.INTERNAL_ERROR, message: 'Corporate details could not be updated.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

function detailsSnapshot(details: {
  institutionName: string;
  dateOfIncorporation: Date;
  rcNumber: string;
  businessPhoneNumber: string;
  businessEmail: string;
  taxIdentificationNumberCiphertext: string | null;
  taxIdentificationNumberIv: string | null;
  taxIdentificationNumberAuthTag: string | null;
  taxIdentificationNumberEncryptedDataKey: string | null;
  taxIdentificationNumberKeyProvider: string | null;
  taxIdentificationNumberKeyId: string | null;
  taxIdentificationNumberKeyVersion: string | null;
  taxIdentificationNumberContextVersion: number | null;
  version: number;
}): Prisma.InputJsonObject {
  return {
    institutionName: details.institutionName,
    dateOfIncorporation: details.dateOfIncorporation.toISOString().slice(0, 10),
    rcNumber: details.rcNumber,
    businessPhoneNumber: details.businessPhoneNumber,
    businessEmail: details.businessEmail,
    taxIdentificationNumberEnvelope: {
      ciphertext: details.taxIdentificationNumberCiphertext,
      iv: details.taxIdentificationNumberIv,
      authTag: details.taxIdentificationNumberAuthTag,
      encryptedDataKey: details.taxIdentificationNumberEncryptedDataKey,
      keyProvider: details.taxIdentificationNumberKeyProvider,
      keyId: details.taxIdentificationNumberKeyId,
      keyVersion: details.taxIdentificationNumberKeyVersion,
      contextVersion: details.taxIdentificationNumberContextVersion,
    },
    version: details.version,
  };
}
