import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  OnboardingApplicationHistoryEvent,
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  Prisma,
} from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CorporateDraftBootstrapInput, canonicalizeCorporateDraftBootstrap } from '../dto/corporate-draft-bootstrap.input';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import {
  CorporateDraftPayloadFingerprinter,
  digestCorporateDraftIdempotencyKey,
} from '../crypto/corporate-draft-fingerprint';

/**
 * Internal C1.1A non-TIN compatibility/bootstrap operation. The public six-field
 * O2 route uses CorporateO2DraftService and is guarded by the activation gate;
 * this legacy typed payload still cannot carry or persist a TIN.
 */
export const CORPORATE_DRAFT_BOOTSTRAP_OPERATION = 'CORPORATE_DRAFT_BOOTSTRAP_NON_TIN_V1';
const MAX_SERIALIZATION_RETRIES = 3;
const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

export interface CorporateDraftBootstrapReceipt {
  corporateAccountId: string;
  applicationId: string;
  applicationStatus: 'DRAFT';
  detailsVersion: 1;
}

interface TransactionContext {
  initiatingUserId: string;
  operation: string;
  keyDigest: string;
  payloadFingerprintHmac: string;
}

@Injectable()
export class CorporateDraftBootstrapService {
  private readonly logger = new Logger(CorporateDraftBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: CorporateApplicantContextService,
    private readonly fingerprinter: CorporateDraftPayloadFingerprinter,
  ) {}

  async createDraft(
    principal: AuthPrincipal | null | undefined,
    input: CorporateDraftBootstrapInput,
    idempotencyKey: string | undefined,
  ): Promise<CorporateDraftBootstrapReceipt> {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    const payload = canonicalizeCorporateDraftBootstrap(input);
    this.validateIdempotencyKey(idempotencyKey);

    const operation = CORPORATE_DRAFT_BOOTSTRAP_OPERATION;
    const keyDigest = digestKey(applicant.initiatingUserId, operation, idempotencyKey!);
    // The configured fingerprinter only accepts the five non-TIN fields. A
    // missing/invalid purpose-specific secret fails before any database write.
    const payloadFingerprintHmac = this.fingerprinter.fingerprint(payload);
    const txContext: TransactionContext = {
      initiatingUserId: applicant.initiatingUserId,
      operation,
      keyDigest,
      payloadFingerprintHmac,
    };

    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.createOrReplayInTransaction(tx, txContext, payload),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5_000,
            timeout: 10_000,
          },
        );
      } catch (error) {
        if (isPrismaCode(error, 'P2034') && attempt + 1 < MAX_SERIALIZATION_RETRIES) {
          continue;
        }
        if (isPrismaCode(error, 'P2002')) {
          const replay = await this.resolveRace(txContext);
          if (replay) return replay;
          throw conflict();
        }
        if (error instanceof HttpException) throw error;

        // Do not log request bodies, business values, fingerprint, or key.
        const category = error instanceof Error ? error.constructor.name : 'unknown';
        this.logger.error(`Corporate draft bootstrap transaction failed [category=${category}].`);
        throw new HttpException(
          { code: ERROR_CODES.INTERNAL_ERROR, message: 'Corporate draft bootstrap could not be completed.' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    throw conflict();
  }

  private async createOrReplayInTransaction(
    tx: Prisma.TransactionClient,
    context: TransactionContext,
    payload: ReturnType<typeof canonicalizeCorporateDraftBootstrap>,
  ): Promise<CorporateDraftBootstrapReceipt> {
    const keyed = await tx.corporateDraftIdempotencyKey.findUnique({
      where: {
        initiatorOperationKey: {
          initiatingUserId: context.initiatingUserId,
          operation: context.operation,
          idempotencyKeyDigest: context.keyDigest,
        },
      },
      include: { creation: true },
    });
    if (keyed) {
      return this.replayOrConflict(
        keyed.creation.payloadFingerprintHmac,
        context,
        keyed.creation.receipt,
      );
    }

    const duplicate = await tx.corporateDraftCreation.findUnique({
      where: {
        initiatorOperationPayload: {
          initiatingUserId: context.initiatingUserId,
          operation: context.operation,
          payloadFingerprintHmac: context.payloadFingerprintHmac,
        },
      },
    });
    if (duplicate) {
      await tx.corporateDraftIdempotencyKey.create({
        data: {
          initiatingUserId: context.initiatingUserId,
          operation: context.operation,
          idempotencyKeyDigest: context.keyDigest,
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
    await tx.corporateOnboardingDetails.create({
      data: {
        applicationId: application.id,
        institutionName: payload.institutionName,
        dateOfIncorporation: new Date(`${payload.dateOfIncorporation}T00:00:00.000Z`),
        rcNumber: payload.rcNumber,
        businessPhoneNumber: payload.businessPhoneNumber,
        businessEmail: payload.businessEmail,
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

    const receipt: CorporateDraftBootstrapReceipt = {
      corporateAccountId: corporateAccount.id,
      applicationId: application.id,
      applicationStatus: 'DRAFT',
      detailsVersion: 1,
    };
    const creation = await tx.corporateDraftCreation.create({
      data: {
        initiatingUserId: context.initiatingUserId,
        operation: context.operation,
        payloadFingerprintHmac: context.payloadFingerprintHmac,
        corporateAccountId: corporateAccount.id,
        applicationId: application.id,
        receipt: receipt as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.corporateDraftIdempotencyKey.create({
      data: {
        initiatingUserId: context.initiatingUserId,
        operation: context.operation,
        idempotencyKeyDigest: context.keyDigest,
        creationId: creation.id,
      },
    });
    return receipt;
  }

  /**
   * Resolve only within the authenticated initiator's scope after a unique-key
   * race. createMany(skipDuplicates) safely aliases a new key to an existing
   * same-user/same-payload receipt without aborting a PostgreSQL transaction.
   */
  private async resolveRace(context: TransactionContext): Promise<CorporateDraftBootstrapReceipt | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const keyed = await tx.corporateDraftIdempotencyKey.findUnique({
          where: {
            initiatorOperationKey: {
              initiatingUserId: context.initiatingUserId,
              operation: context.operation,
              idempotencyKeyDigest: context.keyDigest,
            },
          },
          include: { creation: true },
        });
        if (keyed) return this.replayOrConflict(keyed.creation.payloadFingerprintHmac, context, keyed.creation.receipt);

        const duplicate = await tx.corporateDraftCreation.findUnique({
          where: {
            initiatorOperationPayload: {
              initiatingUserId: context.initiatingUserId,
              operation: context.operation,
              payloadFingerprintHmac: context.payloadFingerprintHmac,
            },
          },
        });
        if (!duplicate) return null;

        await tx.corporateDraftIdempotencyKey.createMany({
          data: [{
            initiatingUserId: context.initiatingUserId,
            operation: context.operation,
            idempotencyKeyDigest: context.keyDigest,
            creationId: duplicate.id,
          }],
          skipDuplicates: true,
        });
        const mapped = await tx.corporateDraftIdempotencyKey.findUnique({
          where: {
            initiatorOperationKey: {
              initiatingUserId: context.initiatingUserId,
              operation: context.operation,
              idempotencyKeyDigest: context.keyDigest,
            },
          },
          include: { creation: true },
        });
        if (!mapped) return null;
        return this.replayOrConflict(mapped.creation.payloadFingerprintHmac, context, mapped.creation.receipt);
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (isPrismaCode(error, 'P2002') || isPrismaCode(error, 'P2034')) return null;
      throw error;
    }
  }

  private replayOrConflict(
    existingFingerprint: string,
    context: TransactionContext,
    receipt?: Prisma.JsonValue,
  ): CorporateDraftBootstrapReceipt {
    if (existingFingerprint !== context.payloadFingerprintHmac) throw conflict();
    if (receipt === undefined) {
      throw new HttpException(
        { code: ERROR_CODES.INTERNAL_ERROR, message: 'Corporate draft receipt is unavailable.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return parseReceipt(receipt);
  }

  private validateIdempotencyKey(key: string | undefined): asserts key is string {
    if (
      typeof key !== 'string' ||
      key.trim().length === 0 ||
      key.length > IDEMPOTENCY_KEY_MAX_LENGTH
    ) {
      throw new HttpException(
        {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'A valid Idempotency-Key is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

function digestKey(userId: string, operation: string, key: string): string {
  return digestCorporateDraftIdempotencyKey(userId, operation, key);
}

function conflict(): HttpException {
  return new HttpException(
    { code: ERROR_CODES.CONFLICT, message: 'The request conflicts with an existing draft creation.' },
    HttpStatus.CONFLICT,
  );
}

function isPrismaCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}

function parseReceipt(value: Prisma.JsonValue): CorporateDraftBootstrapReceipt {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.corporateAccountId === 'string' &&
    typeof value.applicationId === 'string' &&
    value.applicationStatus === 'DRAFT' &&
    value.detailsVersion === 1
  ) {
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
