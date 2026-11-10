import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  OnboardingApplicationHistoryEvent,
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  Prisma,
} from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CORPORATE_O2_HMAC_KEYRING,
  CorporateO2HmacKeyring,
  corporateO2IdempotencyDigests,
  corporateO2PayloadDigests,
  VersionedDigest,
} from '../crypto/corporate-o2-hmac-keyring';
import {
  CORPORATE_TIN_ENCRYPTION_PROVIDER,
  CorporateTinEncryptionProvider,
} from '../crypto/corporate-tin-encryption';
import { CorporateO2CreateApplicationDto, canonicalizeCorporateO2Input } from '../dto/corporate-o2-create-application.input';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';

export const CORPORATE_O2_CREATE_OPERATION = 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1';
const MAX_SERIALIZATION_RETRIES = 3;
const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

export interface CorporateO2DraftReceipt {
  corporateAccountId: string;
  applicationId: string;
  applicationStatus: 'DRAFT';
  detailsVersion: 1;
}

interface O2TransactionContext {
  initiatingUserId: string;
  operation: string;
  idempotencyDigests: VersionedDigest[];
  payloadDigests: VersionedDigest[];
  activeIdempotencyDigest: VersionedDigest;
  activePayloadDigest: VersionedDigest;
}

@Injectable()
export class CorporateO2DraftService {
  private readonly logger = new Logger(CorporateO2DraftService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: CorporateApplicantContextService,
    @Inject(CORPORATE_TIN_ENCRYPTION_PROVIDER)
    private readonly tinEncryption: CorporateTinEncryptionProvider,
    @Inject(CORPORATE_O2_HMAC_KEYRING)
    private readonly hmacKeyring: CorporateO2HmacKeyring,
  ) {}

  async createDraft(
    principal: AuthPrincipal | null | undefined,
    input: CorporateO2CreateApplicationDto,
    idempotencyKey: string | undefined,
  ): Promise<CorporateO2DraftReceipt> {
    // This guard is repeated at service level so non-HTTP callers cannot bypass
    // authentication or the current verified-email check.
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    const payload = canonicalizeCorporateO2Input(input);
    validateIdempotencyKey(idempotencyKey);

    const keyring = this.readKeyring();
    const operation = CORPORATE_O2_CREATE_OPERATION;
    const payloadDigests = corporateO2PayloadDigests(payload, keyring);
    const idempotencyDigests = corporateO2IdempotencyDigests(
      applicant.initiatingUserId,
      operation,
      idempotencyKey,
      keyring,
    );
    const activePayloadDigest = payloadDigests.find(({ keyVersion }) => keyVersion === keyring.activeVersion);
    const activeIdempotencyDigest = idempotencyDigests.find(({ keyVersion }) => keyVersion === keyring.activeVersion);
    if (!activePayloadDigest || !activeIdempotencyDigest) throw serviceUnavailable();

    const context: O2TransactionContext = {
      initiatingUserId: applicant.initiatingUserId,
      operation,
      payloadDigests,
      idempotencyDigests,
      activeIdempotencyDigest,
      activePayloadDigest,
    };

    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.createOrReplayInTransaction(tx, context, payload),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5_000,
            timeout: 15_000,
          },
        );
      } catch (error) {
        if (isPrismaCode(error, 'P2034') && attempt + 1 < MAX_SERIALIZATION_RETRIES) continue;
        if (isPrismaCode(error, 'P2002')) {
          const replay = await this.resolveRace(context);
          if (replay) return replay;
          throw conflict();
        }
        if (error instanceof HttpException) throw error;
        const category = error instanceof Error ? error.constructor.name : 'unknown';
        // Never log the request, raw idempotency key, TIN, HMAC, or provider error details.
        this.logger.error(`Corporate O2 transaction failed [category=${category}].`);
        throw new HttpException(
          { code: ERROR_CODES.INTERNAL_ERROR, message: 'Corporate registration could not be completed.' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
    throw conflict();
  }

  private readKeyring(): CorporateO2HmacKeyring {
    try {
      const keys = this.hmacKeyring.keys;
      const activeVersion = this.hmacKeyring.activeVersion;
      if (!keys.length || !keys.some((key) => key.version === activeVersion && key.key.length >= 32)) {
        throw serviceUnavailable();
      }
      return { activeVersion, keys };
    } catch {
      throw serviceUnavailable();
    }
  }

  private async createOrReplayInTransaction(
    tx: Prisma.TransactionClient,
    context: O2TransactionContext,
    payload: ReturnType<typeof canonicalizeCorporateO2Input>,
  ): Promise<CorporateO2DraftReceipt> {
    const keyed = await tx.corporateDraftIdempotencyKey.findFirst({
      where: {
        initiatingUserId: context.initiatingUserId,
        operation: context.operation,
        idempotencyKeyDigest: { in: context.idempotencyDigests.map(({ digest }) => digest) },
      },
      include: { creation: true },
    });
    if (keyed) return this.replayOrConflict(keyed.creation, context);

    const duplicate = await this.findDuplicate(tx, context);
    if (duplicate) {
      await tx.corporateDraftIdempotencyKey.create({
        data: {
          initiatingUserId: context.initiatingUserId,
          operation: context.operation,
          idempotencyKeyDigest: context.activeIdempotencyDigest.digest,
          idempotencyHmacVersion: context.activeIdempotencyDigest.keyVersion,
          creationId: duplicate.id,
        },
      });
      return parseReceipt(duplicate.receipt);
    }

    const corporateAccount = await tx.corporateAccount.create({ data: {} });
    const application = await tx.onboardingApplication.create({
      data: {
        kind: OnboardingApplicationKind.CORPORATE,
        ownerCorporateAccountId: corporateAccount.id,
        initiatingUserId: context.initiatingUserId,
        status: OnboardingApplicationStatus.DRAFT,
        submittedByUserId: null,
        submittedAt: null,
      },
    });

    // Encrypt after IDs exist so KMS and AES-GCM context bind the envelope to
    // this exact application. Any failure aborts the transaction and all rows.
    const encryptedTin = await this.tinEncryption.encrypt(payload.taxIdentificationNumber, application.id);
    await tx.corporateOnboardingDetails.create({
      data: {
        applicationId: application.id,
        institutionName: payload.institutionName,
        dateOfIncorporation: new Date(`${payload.dateOfIncorporation}T00:00:00.000Z`),
        rcNumber: payload.rcNumber,
        businessPhoneNumber: payload.businessPhoneNumber,
        businessEmail: payload.businessEmail,
        taxIdentificationNumberCiphertext: encryptedTin.ciphertext,
        taxIdentificationNumberIv: encryptedTin.iv,
        taxIdentificationNumberAuthTag: encryptedTin.authTag,
        taxIdentificationNumberEncryptedDataKey: encryptedTin.encryptedDataKey,
        taxIdentificationNumberKeyProvider: encryptedTin.keyProvider,
        taxIdentificationNumberKeyId: encryptedTin.keyId,
        taxIdentificationNumberKeyVersion: encryptedTin.keyVersion,
        taxIdentificationNumberContextVersion: encryptedTin.contextVersion,
        version: 1,
      },
    });
    await tx.onboardingApplicationHistory.create({
      data: {
        applicationId: application.id,
        event: OnboardingApplicationHistoryEvent.CREATED,
        fromStatus: null,
        toStatus: OnboardingApplicationStatus.DRAFT,
        actorUserId: context.initiatingUserId,
      },
    });

    const receipt: CorporateO2DraftReceipt = {
      corporateAccountId: corporateAccount.id,
      applicationId: application.id,
      applicationStatus: 'DRAFT',
      detailsVersion: 1,
    };
    const creation = await tx.corporateDraftCreation.create({
      data: {
        initiatingUserId: context.initiatingUserId,
        operation: context.operation,
        payloadFingerprintHmac: context.activePayloadDigest.digest,
        payloadFingerprintKeyVersion: context.activePayloadDigest.keyVersion,
        corporateAccountId: corporateAccount.id,
        applicationId: application.id,
        receipt: receipt as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.corporateDraftIdempotencyKey.create({
      data: {
        initiatingUserId: context.initiatingUserId,
        operation: context.operation,
        idempotencyKeyDigest: context.activeIdempotencyDigest.digest,
        idempotencyHmacVersion: context.activeIdempotencyDigest.keyVersion,
        creationId: creation.id,
      },
    });
    return receipt;
  }

  private async findDuplicate(tx: Prisma.TransactionClient, context: O2TransactionContext) {
    return tx.corporateDraftCreation.findFirst({
      where: {
        initiatingUserId: context.initiatingUserId,
        operation: context.operation,
        payloadFingerprintHmac: { in: context.payloadDigests.map(({ digest }) => digest) },
      },
    });
  }

  private replayOrConflict(
    creation: { payloadFingerprintHmac: string; receipt: Prisma.JsonValue },
    context: O2TransactionContext,
  ): CorporateO2DraftReceipt {
    if (!context.payloadDigests.some(({ digest }) => digest === creation.payloadFingerprintHmac)) throw conflict();
    return parseReceipt(creation.receipt);
  }

  private async resolveRace(context: O2TransactionContext): Promise<CorporateO2DraftReceipt | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const keyed = await tx.corporateDraftIdempotencyKey.findFirst({
          where: {
            initiatingUserId: context.initiatingUserId,
            operation: context.operation,
            idempotencyKeyDigest: { in: context.idempotencyDigests.map(({ digest }) => digest) },
          },
          include: { creation: true },
        });
        if (keyed) return this.replayOrConflict(keyed.creation, context);

        const duplicate = await this.findDuplicate(tx, context);
        if (!duplicate) return null;
        await tx.corporateDraftIdempotencyKey.createMany({
          data: [{
            initiatingUserId: context.initiatingUserId,
            operation: context.operation,
            idempotencyKeyDigest: context.activeIdempotencyDigest.digest,
            idempotencyHmacVersion: context.activeIdempotencyDigest.keyVersion,
            creationId: duplicate.id,
          }],
          skipDuplicates: true,
        });
        const mapped = await tx.corporateDraftIdempotencyKey.findFirst({
          where: {
            initiatingUserId: context.initiatingUserId,
            operation: context.operation,
            idempotencyKeyDigest: { in: context.idempotencyDigests.map(({ digest }) => digest) },
          },
          include: { creation: true },
        });
        return mapped ? this.replayOrConflict(mapped.creation, context) : null;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (isPrismaCode(error, 'P2002') || isPrismaCode(error, 'P2034')) return null;
      throw error;
    }
  }
}

function validateIdempotencyKey(key: string | undefined): asserts key is string {
  if (typeof key !== 'string' || key.trim().length === 0 || key.length > IDEMPOTENCY_KEY_MAX_LENGTH || key.includes('\r') || key.includes('\n') || key.includes(String.fromCharCode(0))) {
    throw new HttpException(
      { code: ERROR_CODES.VALIDATION_FAILED, message: 'A valid Idempotency-Key is required.' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function serviceUnavailable(): HttpException {
  return new HttpException(
    { code: 'SERVICE_UNAVAILABLE', message: 'Corporate registration is temporarily unavailable.' },
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}

function conflict(): HttpException {
  return new HttpException(
    { code: ERROR_CODES.CONFLICT, message: 'The request conflicts with an existing draft creation.' },
    HttpStatus.CONFLICT,
  );
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function parseReceipt(value: Prisma.JsonValue): CorporateO2DraftReceipt {
  if (value && typeof value === 'object' && !Array.isArray(value) &&
      typeof value.corporateAccountId === 'string' && typeof value.applicationId === 'string' &&
      value.applicationStatus === 'DRAFT' && value.detailsVersion === 1) {
    return {
      corporateAccountId: value.corporateAccountId,
      applicationId: value.applicationId,
      applicationStatus: 'DRAFT',
      detailsVersion: 1,
    };
  }
  throw new HttpException(
    { code: ERROR_CODES.INTERNAL_ERROR, message: 'Corporate draft receipt is unavailable.' },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
