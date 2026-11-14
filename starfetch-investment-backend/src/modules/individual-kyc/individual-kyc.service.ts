import {
  BadRequestException, ConflictException, Inject, Injectable, Logger,
  NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import {
  IndividualKycDocumentScanStatus, IndividualKycDocumentStatus,
  IndividualKycEncryptionProvider, IndividualKycProfileEventKind,
  IndividualKycProfileStatus, IndividualKycSection, IndividualKycSectionStatus, Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  IndividualKycEncryptionProvider as IndividualKycEncryptionPort,
  IndividualKycEncryptedPayload, INDIVIDUAL_KYC_ENCRYPTION,
} from './individual-kyc-encryption';
import {
  INDIVIDUAL_KYC_DOCUMENT_STORAGE, INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS,
  IndividualKycDocumentStorage, MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES,
} from './individual-kyc-document-ports';
import {
  allSectionsComplete, calculateSectionStatuses, emptySectionStatuses,
  IndividualKycPayload, isOtherSource, KycDocumentState, maskNuban, missingOtherSourceDetail,
  normalizeLegacyKycPayload,
} from './individual-kyc.contract';
import {
  BankDetailsKycSectionDto, IdDocumentUploadIntentDto,
  InvestmentProfileKycSectionDto, PersonalKycSectionDto,
  SourceOfFundsKycSectionDto,
} from './dto/individual-kyc.dto';

const ALLOWED_CONTENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MUTABLE_PROFILE_ERROR = 'Only a draft Individual KYC profile can be changed.';

@Injectable()
export class IndividualKycService {
  private readonly logger = new Logger(IndividualKycService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INDIVIDUAL_KYC_ENCRYPTION) private readonly encryption: IndividualKycEncryptionPort,
    @Inject(INDIVIDUAL_KYC_DOCUMENT_STORAGE) private readonly storage: IndividualKycDocumentStorage,
  ) {}

  async getOwn(userId: string) {
    const profile = await this.prisma.individualKycProfile.findUnique({
      where: { investorUserId: userId },
      include: { documents: { orderBy: { createdAt: 'asc' }, select: {
        id: true, documentType: true, originalFilename: true, contentType: true,
        sizeBytes: true, status: true, scanStatus: true, scannerVersion: true,
        scanCompletedAt: true, uploadedAt: true, createdAt: true,
      } } },
    });
    if (!profile) return {
      status: IndividualKycProfileStatus.DRAFT, version: 0, submittedAt: null, updatedAt: null,
      sections: {}, sectionStatuses: emptySectionStatuses(), documents: [],
      progression: { nextSection: 'personal', canSubmit: false },
    };
    const payload = await this.decryptPayload(profile);
    const docs: KycDocumentState[] = profile.documents.map((doc) => ({
      id: doc.id, documentType: doc.documentType, status: doc.status, scanStatus: doc.scanStatus,
    }));
    const sectionStatuses = calculateSectionStatuses(payload, docs);
    const sections = {
      ...(payload.personal ? { personal: payload.personal } : {}),
      ...(payload.investmentProfile ? { investmentProfile: payload.investmentProfile } : {}),
      ...(payload.sourceOfFunds ? { sourceOfFunds: payload.sourceOfFunds } : {}),
      ...(payload.bankDetails ? { bankDetails: {
        ...omitAccountNumber(payload.bankDetails),
        accountNumberMasked: maskNuban(payload.bankDetails.accountNumber),
      } } : {}),
    };
    return {
      status: profile.status, version: profile.version,
      submittedAt: profile.submittedAt?.toISOString() ?? null,
      updatedAt: profile.updatedAt.toISOString(), sections, sectionStatuses,
      documents: profile.documents.map((doc) => ({
        id: doc.id, documentType: doc.documentType, originalFilename: doc.originalFilename,
        contentType: doc.contentType, sizeBytes: doc.sizeBytes.toString(), status: doc.status,
        scanStatus: doc.scanStatus, scannerVersion: doc.scannerVersion,
        scanCompletedAt: doc.scanCompletedAt?.toISOString() ?? null,
        uploadedAt: doc.uploadedAt?.toISOString() ?? null,
        createdAt: doc.createdAt.toISOString(),
      })),
      progression: { nextSection: nextSection(sectionStatuses), canSubmit: profile.status === 'DRAFT' && allSectionsComplete(sectionStatuses) },
    };
  }

  async savePersonal(userId: string, dto: PersonalKycSectionDto) {
    return this.saveSection(userId, dto.version, IndividualKycSection.PERSONAL, (payload) => {
      const next = mergePatch(payload.personal, stripVersion(dto)) as IndividualKycPayload['personal'];
      if (next?.pepStatus === 'NO') delete next.pepDetails;
      validatePepCondition(next);
      return { ...payload, personal: next };
    });
  }

  async saveInvestment(userId: string, dto: InvestmentProfileKycSectionDto) {
    return this.saveSection(userId, dto.version, IndividualKycSection.INVESTMENT, (payload) => ({
      ...payload,
      investmentProfile: mergePatch(payload.investmentProfile, stripVersion(dto)) as IndividualKycPayload['investmentProfile'],
    }));
  }

  async saveSourceOfFunds(userId: string, dto: SourceOfFundsKycSectionDto) {
    return this.saveSection(userId, dto.version, IndividualKycSection.SOURCE_OF_FUNDS, (payload) => {
      const next = mergePatch(payload.sourceOfFunds, stripVersion(dto)) as IndividualKycPayload['sourceOfFunds'];
      if (next?.sourceOfFunds && !isOtherSource(next.sourceOfFunds)) delete next.otherSource;
      return { ...payload, sourceOfFunds: next };
    });
  }

  async saveBankDetails(userId: string, dto: BankDetailsKycSectionDto) {
    return this.saveSection(userId, dto.version, IndividualKycSection.BANK, (payload) => ({
      ...payload,
      bankDetails: mergePatch(payload.bankDetails, stripVersion(dto)) as IndividualKycPayload['bankDetails'],
    }));
  }

  async createUploadIntent(userId: string, dto: IdDocumentUploadIntentDto) {
    if (!ALLOWED_CONTENT_TYPES.has(dto.contentType)) {
      throw new BadRequestException({ code: 'UNSUPPORTED_FILE_TYPE', message: 'Supported document types are PDF, JPEG, and PNG.' });
    }
    if (dto.sizeBytes < 1 || dto.sizeBytes > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'The document must be between 1 byte and 10 MiB.' });
    }
    if (!isSha256Base64(dto.checksumSha256)) {
      throw new BadRequestException({ code: 'INVALID_CHECKSUM', message: 'Provide the SHA-256 checksum of the exact document bytes.' });
    }
    const profile = await this.ensureDraftProfile(userId, dto.version);
    assertVersion(profile.version, dto.version);
    if (profile.status !== IndividualKycProfileStatus.DRAFT) throw immutableProfile();
    const documentId = randomUUID();
    // Do not embed the investor ID in an object key. Ownership exists only in
    // the authenticated DB relation; object/document IDs are server-generated.
    const storageKey = `individual-kyc/quarantine/${randomUUID()}`;
    const issuedAt = Date.now();
    const intent = await this.storage.createUploadIntent({
      documentId,
      objectKey: storageKey,
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      checksumSha256: dto.checksumSha256,
      expiresInSeconds: INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS,
    });
    if (!intent.uploadUrl.startsWith('https://') || intent.expiresAt.getTime() <= issuedAt ||
      intent.expiresAt.getTime() > issuedAt + INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS * 1000 + 5_000 ||
      !intent.requiredHeaders['if-none-match'] || intent.requiredHeaders['if-none-match'] !== '*' ||
      intent.signedContentLength !== dto.sizeBytes ||
      intent.requiredHeaders['x-amz-checksum-sha256'] !== dto.checksumSha256) {
      throw new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Private document upload authorization is not configured safely.' });
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.individualKycProfile.updateMany({
        where: { id: profile.id, investorUserId: userId, version: dto.version, status: IndividualKycProfileStatus.DRAFT },
        data: { version: { increment: 1 } },
      });
      if (changed.count !== 1) throw staleVersion();
      const document = await tx.individualKycDocument.create({ data: {
        id: documentId,
        kycProfileId: profile.id,
        investorUserId: userId,
        documentType: dto.documentType,
        storageKey,
        originalFilename: sanitizeFilename(dto.originalFilename),
        contentType: dto.contentType,
        sizeBytes: BigInt(dto.sizeBytes),
        expectedChecksumSha256: dto.checksumSha256,
        uploadExpiresAt: intent.expiresAt,
      }, select: { id: true } });
      const version = dto.version + 1;
      await tx.individualKycProfileEvent.create({ data: {
        kycProfileId: profile.id,
        actorUserId: userId,
        eventKind: IndividualKycProfileEventKind.ID_DOCUMENT_UPLOAD_INTENT_CREATED,
        profileVersion: version,
        relatedDocumentId: document.id,
      } });
      return { documentId: document.id, version };
    });
    return {
      ...created,
      uploadUrl: intent.uploadUrl,
      requiredHeaders: intent.requiredHeaders,
      signedContentLength: intent.signedContentLength,
      expiresAt: intent.expiresAt.toISOString(),
      uploadExpiresInSeconds: INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS,
    };
  }

  async completeDocument(userId: string, documentId: string, version: number) {
    const profile = await this.prisma.individualKycProfile.findUnique({ where: { investorUserId: userId } });
    if (!profile) throw new NotFoundException('Document not found.');
    assertVersion(profile.version, version);
    if (profile.status !== IndividualKycProfileStatus.DRAFT) throw immutableProfile();
    const document = await this.prisma.individualKycDocument.findFirst({
      where: { id: documentId, investorUserId: userId, kycProfileId: profile.id },
    });
    if (!document || document.status !== IndividualKycDocumentStatus.PENDING_UPLOAD) throw new NotFoundException('Document not found.');
    if (document.uploadExpiresAt.getTime() <= Date.now()) throw new BadRequestException({ code: 'UPLOAD_EXPIRED', message: 'The upload authorization has expired.' });

    let metadata;
    try {
      // HEAD only: the API/Vercel process never fetches or buffers document bytes.
      metadata = await this.storage.headQuarantined(document.storageKey);
    } catch {
      throw new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Document metadata validation is temporarily unavailable.' });
    }
    if (!metadata) throw new BadRequestException({ code: 'UPLOAD_NOT_FOUND', message: 'No uploaded object was found for this authorization.' });
    const invalid = !metadata.versionId || metadata.sizeBytes !== Number(document.sizeBytes) ||
      metadata.sizeBytes < 1 || metadata.sizeBytes > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES ||
      metadata.contentType !== document.contentType || metadata.documentIdMetadata !== document.id ||
      metadata.checksumSha256 !== document.expectedChecksumSha256 || metadata.serverSideEncryption !== 'AES256' ||
      !document.expectedChecksumSha256;
    if (invalid) throw new BadRequestException({ code: 'UPLOAD_VALIDATION_FAILED', message: 'Uploaded object metadata, size, encryption or checksum did not match the signed upload.' });

    const queuedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changedProfile = await tx.individualKycProfile.updateMany({
        where: { id: profile.id, investorUserId: userId, version, status: IndividualKycProfileStatus.DRAFT },
        data: { version: { increment: 1 } },
      });
      if (changedProfile.count !== 1) throw staleVersion();
      const changedDocument = await tx.individualKycDocument.updateMany({
        where: { id: document.id, kycProfileId: profile.id, investorUserId: userId, status: IndividualKycDocumentStatus.PENDING_UPLOAD },
        data: {
          status: IndividualKycDocumentStatus.PENDING_SCAN,
          scanStatus: IndividualKycDocumentScanStatus.PENDING,
          storageObjectVersionId: metadata.versionId,
          uploadedAt: queuedAt,
          scanRequestedAt: queuedAt,
          scanAttemptCount: 0,
        },
      });
      if (changedDocument.count !== 1) throw staleVersion();
      const nextVersion = version + 1;
      await tx.individualKycProfileEvent.create({ data: {
        kycProfileId: profile.id,
        actorUserId: userId,
        eventKind: IndividualKycProfileEventKind.ID_DOCUMENT_SCAN_QUEUED,
        section: IndividualKycSection.PERSONAL,
        profileVersion: nextVersion,
        relatedDocumentId: document.id,
      } });
      return {
        documentId: document.id,
        version: nextVersion,
        status: IndividualKycDocumentStatus.PENDING_SCAN,
        scanStatus: IndividualKycDocumentScanStatus.PENDING,
      };
    });
  }

  async submit(userId: string, version: number) {
    const profile = await this.prisma.individualKycProfile.findUnique({
      where: { investorUserId: userId },
      include: { documents: { select: { id: true, documentType: true, status: true, scanStatus: true } } },
    });
    if (!profile) throw new ConflictException({ code: 'CONFLICT', message: 'Complete all required KYC sections before submission.' });
    assertVersion(profile.version, version);
    if (profile.status !== IndividualKycProfileStatus.DRAFT) throw immutableProfile();
    const payload = await this.decryptPayload(profile);
    if (missingOtherSourceDetail(payload.sourceOfFunds)) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Provide otherSource when OTHER is selected before completing Source of Funds.' });
    }
    const statuses = calculateSectionStatuses(payload, profile.documents);
    if (!allSectionsComplete(statuses)) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Complete all four KYC sections and provide a clean matching identity document before submission.' });
    }
    const submittedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.individualKycProfile.updateMany({
        where: { id: profile.id, investorUserId: userId, version, status: IndividualKycProfileStatus.DRAFT },
        data: {
          status: IndividualKycProfileStatus.SUBMITTED, submittedAt, version: { increment: 1 },
          personalSectionStatus: statuses.personal, investmentSectionStatus: statuses.investment,
          sourceOfFundsSectionStatus: statuses.sourceOfFunds, bankSectionStatus: statuses.bank,
        },
      });
      if (changed.count !== 1) throw staleVersion();
      const nextVersion = version + 1;
      await tx.individualKycProfileEvent.create({ data: {
        kycProfileId: profile.id, actorUserId: userId,
        eventKind: IndividualKycProfileEventKind.SUBMITTED, profileVersion: nextVersion,
      } });
      return { status: IndividualKycProfileStatus.SUBMITTED, submittedAt: submittedAt.toISOString(), version: nextVersion };
    });
  }

  private async saveSection(userId: string, version: number, section: IndividualKycSection, patcher: (payload: IndividualKycPayload) => IndividualKycPayload) {
    const profile = await this.ensureDraftProfile(userId, version);
    assertVersion(profile.version, version);
    if (profile.status !== IndividualKycProfileStatus.DRAFT) throw immutableProfile();
    const payload = patcher(await this.decryptPayload(profile));
    validateSupportedPayload(payload);
    const statuses = calculateSectionStatuses(payload, profile.documents);
    const nextVersion = version + 1;
    const encrypted = await this.encryption.encrypt(JSON.stringify(payload), profile.id, userId);
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.individualKycProfile.updateMany({
        where: { id: profile.id, investorUserId: userId, version, status: IndividualKycProfileStatus.DRAFT },
        data: {
          ...envelopeToColumns(encrypted), version: { increment: 1 },
          personalSectionStatus: statuses.personal, investmentSectionStatus: statuses.investment,
          sourceOfFundsSectionStatus: statuses.sourceOfFunds, bankSectionStatus: statuses.bank,
        },
      });
      if (changed.count !== 1) throw staleVersion();
      await tx.individualKycProfileEvent.create({ data: {
        kycProfileId: profile.id, actorUserId: userId,
        eventKind: IndividualKycProfileEventKind.SECTION_SAVED, section, profileVersion: nextVersion,
      } });
      return { version: nextVersion, sectionStatuses: statuses, progression: { nextSection: nextSection(statuses), canSubmit: allSectionsComplete(statuses) } };
    });
  }

  private async ensureDraftProfile(userId: string, version: number) {
    const existing = await this.prisma.individualKycProfile.findUnique({
      where: { investorUserId: userId },
      include: { documents: { select: { id: true, documentType: true, status: true, scanStatus: true } } },
    });
    if (existing) return existing;
    if (version !== 0) throw staleVersion();
    try {
      return await this.prisma.individualKycProfile.create({
        data: { id: randomUUID(), investorUserId: userId, version: 0 },
        include: { documents: { select: { id: true, documentType: true, status: true, scanStatus: true } } },
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw staleVersion();
      throw error;
    }
  }

  private async decryptPayload(profile: {
    id: string; investorUserId: string; encryptedPayload: string | null; payloadIv: string | null;
    payloadAuthTag: string | null; encryptedDataKey: string | null; encryptionKeyProvider: string | null;
    encryptionKeyId: string | null; encryptionKeyVersion: string | null; encryptionContextVersion: number | null;
  }): Promise<IndividualKycPayload> {
    if (!profile.encryptedPayload && !profile.payloadIv && !profile.payloadAuthTag && !profile.encryptedDataKey) return {};
    if (!profile.encryptedPayload || !profile.payloadIv || !profile.payloadAuthTag || !profile.encryptedDataKey ||
      !profile.encryptionKeyProvider || !profile.encryptionKeyId || !profile.encryptionKeyVersion || profile.encryptionContextVersion === null) {
      throw new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Saved KYC data could not be decrypted.' });
    }
    const envelope: IndividualKycEncryptedPayload = {
      encryptedPayload: profile.encryptedPayload, payloadIv: profile.payloadIv,
      payloadAuthTag: profile.payloadAuthTag, encryptedDataKey: profile.encryptedDataKey,
      encryptionKeyProvider: profile.encryptionKeyProvider as IndividualKycEncryptedPayload['encryptionKeyProvider'],
      encryptionKeyId: profile.encryptionKeyId, encryptionKeyVersion: profile.encryptionKeyVersion,
      encryptionContextVersion: profile.encryptionContextVersion as 1,
    };
    let plaintext: Buffer | undefined;
    try {
      const decrypted = await this.encryption.decrypt(envelope, profile.id, profile.investorUserId);
      plaintext = decrypted;
      const parsed: unknown = JSON.parse(decrypted.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid payload shape');
      const normalized = normalizeLegacyKycPayload(parsed as IndividualKycPayload);
      validateSupportedPayload(normalized);
      return normalized;
    } catch {
      this.logger.warn('Individual KYC encrypted profile could not be restored; returning a safe failure.');
      throw new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Saved KYC data could not be restored.' });
    } finally {
      plaintext?.fill(0);
    }
  }


}

function omitAccountNumber<T extends { accountNumber?: string | null }>(value: T): Omit<T, 'accountNumber'> {
  const safe = { ...value };
  delete safe.accountNumber;
  return safe;
}

function stripVersion(dto: object): Record<string, unknown> {
  const value = { ...(dto as Record<string, unknown>) };
  delete value.version;
  return value;
}

function mergePatch<T extends object>(current: T | undefined, patch: Record<string, unknown>): T {
  const result = { ...(current ?? {}) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) delete result[key];
    else if (key === 'pepDetails' && value && typeof value === 'object') result[key] = mergePatch(result[key] as object | undefined, value as Record<string, unknown>);
    else result[key] = value;
  }
  return result as T;
}

function validatePepCondition(personal: IndividualKycPayload['personal']): void {
  if (!personal?.pepDetails) return;
  // Partial PEP details are accepted as a draft after a YES declaration;
  // completion requires the full conditional data set.
  if (personal.pepStatus !== 'YES' && Object.values(personal.pepDetails).some((value) => value != null && String(value).trim() !== '')) {
    throw new BadRequestException('PEP details are only supported when pepStatus is YES.');
  }
}

function validateSupportedPayload(payload: IndividualKycPayload): void {
  const allowed = new Set(['personal', 'investmentProfile', 'sourceOfFunds', 'bankDetails']);
  if (Object.keys(payload).some((key) => !allowed.has(key))) throw new BadRequestException('Unsupported KYC field.');
  if (payload.personal && Object.prototype.hasOwnProperty.call(payload.personal, 'bvn')) throw new BadRequestException('Raw BVN is not accepted.');
}

function envelopeToColumns(envelope: IndividualKycEncryptedPayload) {
  return {
    encryptedPayload: envelope.encryptedPayload, payloadIv: envelope.payloadIv,
    payloadAuthTag: envelope.payloadAuthTag, encryptedDataKey: envelope.encryptedDataKey,
    encryptionKeyProvider: envelope.encryptionKeyProvider === 'AWS_KMS' ? IndividualKycEncryptionProvider.AWS_KMS : IndividualKycEncryptionProvider.TEST_AES_GCM,
    encryptionKeyId: envelope.encryptionKeyId, encryptionKeyVersion: envelope.encryptionKeyVersion,
    encryptionContextVersion: envelope.encryptionContextVersion,
  };
}

function assertVersion(actual: number, expected: number): void {
  if (actual !== expected) throw staleVersion();
}
function staleVersion(): ConflictException {
  return new ConflictException({ code: 'CONFLICT', message: 'This KYC profile changed. Refresh the profile and retry your update.' });
}
function immutableProfile(): ConflictException {
  return new ConflictException({ code: 'CONFLICT', message: MUTABLE_PROFILE_ERROR });
}
function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
function nextSection(statuses: ReturnType<typeof calculateSectionStatuses>): string | null {
  if (statuses.personal !== IndividualKycSectionStatus.COMPLETE) return 'personal';
  if (statuses.investment !== IndividualKycSectionStatus.COMPLETE) return 'investment-profile';
  if (statuses.sourceOfFunds !== IndividualKycSectionStatus.COMPLETE) return 'source-of-funds';
  if (statuses.bank !== IndividualKycSectionStatus.COMPLETE) return 'bank-details';
  return null;
}
function sanitizeFilename(filename: string): string {
  const safe = Array.from(filename.normalize('NFKC')).filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0x20 && !(code >= 0x7f && code <= 0x9f);
  }).join('');
  return safe.slice(0, 128) || 'identity-document';
}
function isSha256Base64(value: string): boolean {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 32 && bytes.toString('base64') === value;
}
