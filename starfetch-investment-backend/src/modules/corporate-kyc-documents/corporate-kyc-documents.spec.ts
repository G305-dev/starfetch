import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA, INTERCEPTORS_METADATA } from '@nestjs/common/constants';
import { CorporateProfileSectionStatus, OnboardingApplicationStatus, Prisma } from '@prisma/client';
import { KEYED_RATE_LIMIT_KEY } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CorporateApplicantGuard } from '../corporate-onboarding/guards/corporate-applicant.guard';
import { submissionIdempotencyDigest, validateSubmissionIdempotencyKey } from './corporate-application-submission.service';
import { detectCorporateKycContentType, verifyCorporateKycContent } from './corporate-kyc-document-content';
import {
  CORPORATE_KYC_DOCUMENT_CATEGORIES,
  CORPORATE_KYC_DOCUMENT_REQUIREMENTS,
  CORPORATE_KYC_MAX_DOCUMENT_BYTES,
  displayFilename,
  isCorporateKycDocumentCategory,
} from './corporate-kyc-document-requirements';
import { CorporateKycDocumentsController } from './corporate-kyc-documents.controller';
import { CorporateKycDocumentsService, composeView, documentReviewStatus } from './corporate-kyc-documents.service';
import { evaluateCorporateProfileReadiness } from './corporate-profile-readiness';

const PDF = Buffer.from('%PDF-1.4\n<< /Type /Catalog >>\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.from('IHDR'), Buffer.alloc(8)]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

function statusOf(fn: () => unknown): number | undefined {
  try { fn(); } catch (e) { return e instanceof HttpException ? e.getStatus() : -1; }
  return undefined;
}

describe('Corporate KYC document catalogue', () => {
  it('contains exactly the three approved mandatory categories', () => {
    expect([...CORPORATE_KYC_DOCUMENT_CATEGORIES]).toEqual(['CERTIFICATE_OF_INCORPORATION', 'MEMART', 'TIN_CERTIFICATE']);
    expect(CORPORATE_KYC_DOCUMENT_REQUIREMENTS).toHaveLength(3);
    expect(CORPORATE_KYC_DOCUMENT_REQUIREMENTS.every((r) => r.mandatory === true)).toBe(true);
    for (const rejected of ['CAC_STATUS_REPORT', 'BOARD_RESOLUTION', 'DIRECTOR_ID', 'SCUML_CERTIFICATE', 'memart', '', undefined, 1]) {
      expect(isCorporateKycDocumentCategory(rejected)).toBe(false);
    }
  });

  it('generates PII-free display filenames', () => {
    expect(displayFilename('MEMART', 2, 'image/png')).toBe('memart-v2.png');
    expect(displayFilename('TIN_CERTIFICATE', 1, 'image/jpeg')).toBe('tin-certificate-v1.jpg');
  });
});

describe('verifyCorporateKycContent', () => {
  it('detects types from magic bytes only', () => {
    expect(detectCorporateKycContentType(PDF)).toBe('application/pdf');
    expect(detectCorporateKycContentType(PNG)).toBe('image/png');
    expect(detectCorporateKycContentType(JPEG)).toBe('image/jpeg');
    expect(detectCorporateKycContentType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectCorporateKycContentType(Buffer.from('%PDF-x.y\n'))).toBeNull();
  });

  it('accepts matching declared types (with the image/jpg alias) and returns a SHA-256 checksum', () => {
    expect(verifyCorporateKycContent(PDF, 'application/pdf', 'a.PDF')).toMatchObject({ contentType: 'application/pdf', sizeBytes: PDF.length, checksumSha256Hex: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(verifyCorporateKycContent(JPEG, 'image/jpg', 'a.jpeg').contentType).toBe('image/jpeg');
    expect(verifyCorporateKycContent(PNG, 'image/png', undefined).contentType).toBe('image/png');
  });

  it('rejects empty, oversize, spoofed, mismatched and active-content files', () => {
    expect(statusOf(() => verifyCorporateKycContent(Buffer.alloc(0), 'application/pdf', 'a.pdf'))).toBe(400);
    expect(statusOf(() => verifyCorporateKycContent(Buffer.concat([PDF, Buffer.alloc(CORPORATE_KYC_MAX_DOCUMENT_BYTES)]), 'application/pdf', 'a.pdf'))).toBe(413);
    expect(statusOf(() => verifyCorporateKycContent(Buffer.from('MZ\x90\x00 executable'), 'application/pdf', 'a.pdf'))).toBe(415);
    expect(statusOf(() => verifyCorporateKycContent(PNG, 'image/jpeg', 'a.jpg'))).toBe(415);
    expect(statusOf(() => verifyCorporateKycContent(PDF, 'application/pdf', 'a.exe'))).toBe(415);
    expect(statusOf(() => verifyCorporateKycContent(PDF, undefined, 'a.pdf'))).toBe(415);
    expect(statusOf(() => verifyCorporateKycContent(Buffer.from('%PDF-1.7\n/Launch /F (cmd)\n%%EOF'), 'application/pdf', 'a.pdf'))).toBe(415);
    expect(statusOf(() => verifyCorporateKycContent(Buffer.from('%PDF-1.7\n/EmbeddedFiles 3 0 R\n%%EOF'), 'application/pdf', 'a.pdf'))).toBe(415);
    expect(statusOf(() => verifyCorporateKycContent(Buffer.from('%PDF-1.7\nno trailer'), 'application/pdf', 'a.pdf'))).toBe(415);
  });

  it('does not treat names that merely start with a disallowed token as active content', () => {
    expect(verifyCorporateKycContent(Buffer.from('%PDF-1.7\n/JSON 1 /Encryption-note 2\n%%EOF'), 'application/pdf', 'a.pdf').contentType).toBe('application/pdf');
  });
});

const C = CorporateProfileSectionStatus.COMPLETE;
const details = {
  version: 2, rcNumber: 'RC1', dateOfIncorporation: new Date('2020-01-01'),
  taxIdentificationNumberCiphertext: 'c', taxIdentificationNumberIv: 'i', taxIdentificationNumberAuthTag: 't', taxIdentificationNumberEncryptedDataKey: 'k',
  taxIdentificationNumberKeyProvider: 'AWS_KMS', taxIdentificationNumberKeyId: 'id', taxIdentificationNumberKeyVersion: 'v', taxIdentificationNumberContextVersion: 1,
};
const profile = {
  profileVersion: 4, companyDetailsDetailsVersion: 2,
  companyDetailsStatus: C, investmentProfileStatus: C, sourceOfFundsStatus: C, bankDetailsStatus: C,
  registeredAddress: 'a', city: 'b', state: 'c', primaryObjective: 'o', riskTolerance: 'r', investmentHorizon: 'h', expectedWithdrawals: 'w', withdrawalFrequency: 'f',
  selectedSources: ['Business income / operating cash'], otherSource: null, expectedAnnualInflowMinor: BigInt(1), expectedTransactionFrequency: 'm',
  bankName: 'b', accountName: 'n', accountType: 't', bvnLinkedToAccount: false,
  bankAccountNumberCiphertext: 'c', bankAccountNumberIv: 'i', bankAccountNumberAuthTag: 't', bankAccountNumberEncryptedDataKey: 'k',
  bankAccountNumberKeyProvider: 'AWS_KMS', bankAccountNumberKeyId: 'id', bankAccountNumberKeyVersion: 'v', bankAccountNumberContextVersion: 1,
};

describe('evaluateCorporateProfileReadiness', () => {
  it('is ready only when all four sections are COMPLETE against current details with stored values present', () => {
    expect(evaluateCorporateProfileReadiness(profile, details).incompleteSections).toEqual([]);
    expect(evaluateCorporateProfileReadiness(null, details).incompleteSections).toHaveLength(4);
  });

  it('applies the Corporate Profile staleness rule (older details version demotes all sections)', () => {
    const r = evaluateCorporateProfileReadiness({ ...profile, companyDetailsDetailsVersion: 1 }, details);
    expect(r.effectiveStatuses.companyDetails).toBe(CorporateProfileSectionStatus.DRAFT);
    expect(r.incompleteSections).toEqual(['companyDetails', 'investmentProfile', 'sourceOfFunds', 'bankDetails']);
  });

  it('re-validates stored data behind COMPLETE flags', () => {
    expect(evaluateCorporateProfileReadiness(profile, { ...details, taxIdentificationNumberCiphertext: null }).incompleteSections).toEqual(['companyDetails']);
    expect(evaluateCorporateProfileReadiness({ ...profile, selectedSources: ['Other (specify)'], otherSource: ' ' }, details).incompleteSections).toEqual(['sourceOfFunds']);
    expect(evaluateCorporateProfileReadiness({ ...profile, bankAccountNumberCiphertext: null }, details).incompleteSections).toEqual(['bankDetails']);
    expect(evaluateCorporateProfileReadiness({ ...profile, investmentProfileStatus: CorporateProfileSectionStatus.DRAFT }, details).incompleteSections).toEqual(['investmentProfile']);
  });
});

describe('truthful document statuses', () => {
  it('never reports review before staff workflow accepts the application', () => {
    expect(documentReviewStatus(OnboardingApplicationStatus.DRAFT)).toBe('NOT_SUBMITTED');
    expect(documentReviewStatus(OnboardingApplicationStatus.SUBMITTED)).toBe('AWAITING_REVIEW');
    expect(documentReviewStatus(OnboardingApplicationStatus.IN_REVIEW)).toBe('UNDER_REVIEW');
    expect(documentReviewStatus(OnboardingApplicationStatus.INFO_REQUESTED)).toBe('INFORMATION_REQUESTED');
  });

  it('composes scanStatus NOT_SCANNED and blocks submit outside DRAFT', () => {
    const doc = { id: 'd', applicationId: 'a', category: 'MEMART', version: 1, isCurrent: true, replacesDocumentId: null, storageObjectKey: 'onboarding-documents/d',
      storageObjectVersionId: 'v', contentType: 'application/pdf', sizeBytes: 10, checksumSha256: 'a'.repeat(64), scanStatus: 'NOT_SCANNED',
      uploadedByUserId: 'u', uploadedAt: new Date(), supersededAt: null } as const;
    const view = composeView({ id: 'a', status: OnboardingApplicationStatus.SUBMITTED, ownerCorporateAccountId: 'c' }, [], [doc], null);
    expect(view.requirements[1].currentDocument).toMatchObject({ scanStatus: 'NOT_SCANNED', reviewStatus: 'AWAITING_REVIEW' });
    expect(JSON.stringify(view)).not.toContain('onboarding-documents/');
    expect(view.submission.blockers).toContainEqual({ kind: 'APPLICATION_STATE', key: 'SUBMITTED' });
  });
});

describe('submission idempotency key', () => {
  it('validates and digests keys with domain/application/user separation', () => {
    expect(statusOf(() => validateSubmissionIdempotencyKey(undefined))).toBe(400);
    expect(statusOf(() => validateSubmissionIdempotencyKey('short'))).toBe(400);
    expect(statusOf(() => validateSubmissionIdempotencyKey('valid-key-123\n'))).toBe(400);
    expect(statusOf(() => validateSubmissionIdempotencyKey('x'.repeat(256)))).toBe(400);
    expect(statusOf(() => validateSubmissionIdempotencyKey('valid-key-123'))).toBeUndefined();
    const a = submissionIdempotencyDigest('app-1', 'user-1', 'key-12345');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(submissionIdempotencyDigest('app-2', 'user-1', 'key-12345'));
    expect(a).not.toBe(submissionIdempotencyDigest('app-1', 'user-2', 'key-12345'));
  });
});

describe('CorporateKycDocumentsService.upload storage consistency', () => {
  function harness(txError: unknown) {
    const app: { id: string; status: OnboardingApplicationStatus; initiatingUserId: string; ownerCorporateAccountId: string } = { id: '11111111-1111-4111-8111-111111111111', status: OnboardingApplicationStatus.DRAFT, initiatingUserId: 'u', ownerCorporateAccountId: '22222222-2222-4222-8222-222222222222' };
    const prisma = {
      corporateKycDocument: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockRejectedValue(txError),
    };
    const storage = {
      putDocumentObject: jest.fn().mockResolvedValue('version-1'),
      deleteObjectVersion: jest.fn().mockResolvedValue(undefined),
    };
    const applicants = { requireVerifiedInvestor: jest.fn().mockResolvedValue({ initiatingUserId: 'u' }) };
    const access = { requireInitiatorOwnedCorporateAccount: jest.fn().mockResolvedValue(app) };
    const service = new CorporateKycDocumentsService(prisma as never, applicants as never, access as never, storage as never);
    return { service, storage, app };
  }

  it('deletes the stored object version when the database transaction fails', async () => {
    const { service, storage, app } = harness(new Error('db down'));
    await expect(service.upload({ userId: 'u' } as never, app.ownerCorporateAccountId, 'MEMART', undefined, { bytes: PDF, declaredContentType: 'application/pdf', originalFilename: 'a.pdf' })).rejects.toThrow('db down');
    const key = storage.putDocumentObject.mock.calls[0][0].objectKey;
    expect(key).toMatch(/^onboarding-documents\/[0-9a-f-]{36}$/);
    expect(storage.deleteObjectVersion).toHaveBeenCalledWith(key, 'version-1');
  });

  it('maps serialization failures to 409 CONFLICT after cleanup', async () => {
    const { service, storage, app } = harness(new Prisma.PrismaClientKnownRequestError('serialization', { code: 'P2034', clientVersion: 'test' }));
    await expect(service.upload({ userId: 'u' } as never, app.ownerCorporateAccountId, 'MEMART', undefined, { bytes: PDF, declaredContentType: 'application/pdf', originalFilename: 'a.pdf' })).rejects.toMatchObject({ status: 409 });
    expect(storage.deleteObjectVersion).toHaveBeenCalled();
  });

  it('never calls storage for an invalid file or a non-editable application', async () => {
    const { service, storage, app } = harness(new Error('unused'));
    await expect(service.upload({ userId: 'u' } as never, app.ownerCorporateAccountId, 'MEMART', undefined, { bytes: Buffer.from('nope'), declaredContentType: 'application/pdf', originalFilename: 'a.pdf' })).rejects.toMatchObject({ status: 415 });
    app.status = OnboardingApplicationStatus.SUBMITTED;
    await expect(service.upload({ userId: 'u' } as never, app.ownerCorporateAccountId, 'MEMART', undefined, { bytes: PDF, declaredContentType: 'application/pdf', originalFilename: 'a.pdf' })).rejects.toMatchObject({ status: 409 });
    expect(storage.putDocumentObject).not.toHaveBeenCalled();
  });

  it('propagates unavailable storage as 503 without touching the database', async () => {
    const { service, storage, app } = harness(new Error('unused'));
    storage.putDocumentObject.mockRejectedValueOnce(new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'x' }));
    await expect(service.upload({ userId: 'u' } as never, app.ownerCorporateAccountId, 'MEMART', undefined, { bytes: PDF, declaredContentType: 'application/pdf', originalFilename: 'a.pdf' })).rejects.toMatchObject({ status: 503 });
    expect(storage.deleteObjectVersion).not.toHaveBeenCalled();
  });
});

describe('CorporateKycDocumentsController security wiring', () => {
  const proto = CorporateKycDocumentsController.prototype;
  const guards = (method: keyof typeof proto) => Reflect.getMetadata(GUARDS_METADATA, proto[method]);

  it('protects reads with auth, role, verified Corporate applicant and rate limit', () => {
    expect(guards('getRequirements')).toEqual([AccessTokenGuard, RolesGuard, CorporateApplicantGuard, KeyedRateLimitGuard]);
  });

  it('adds Origin + CSRF before the rate limiter on every mutation, and guards run before multipart parsing', () => {
    for (const method of ['upload', 'authorizeView', 'submit'] as const) {
      expect(guards(method)).toEqual([AccessTokenGuard, RolesGuard, CorporateApplicantGuard, CookieMutationGuard, KeyedRateLimitGuard]);
      expect(Reflect.getMetadata(KEYED_RATE_LIMIT_KEY, proto[method])).toMatchObject({ identity: 'user', windowSeconds: 3600 });
    }
    expect(Reflect.getMetadata(INTERCEPTORS_METADATA, proto.upload)).toHaveLength(1);
  });
});
