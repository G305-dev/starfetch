import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertDestructiveTestDatabaseAllowed,
  DESIGNATED_TEST_DATABASE,
} from './utils/e2e-db-guard';

const enabled = process.env.RUN_INDIVIDUAL_KYC_DB_INTEGRATION === '1';
const describeDatabase = enabled ? describe : describe.skip;
const checksum = `${'A'.repeat(43)}=`;
const uploadExpiry = () => new Date(Date.now() + 10 * 60 * 1000);
const uploadTime = () => new Date();
const retentionExpiry = (uploadedAt: Date) => new Date(uploadedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

let prisma: PrismaClient;

class RollbackProbe extends Error {}

async function withRollback(work: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await work(tx);
      throw new RollbackProbe('Expected test-only rollback');
    });
  } catch (error) {
    if (!(error instanceof RollbackProbe)) throw error;
  }
}

async function expectRejectedWithinSavepoint(
  tx: Prisma.TransactionClient,
  statement: () => Promise<unknown>,
): Promise<void> {
  await tx.$executeRawUnsafe('SAVEPOINT kyc_completion_reject');
  let failure: unknown;
  try {
    await statement();
  } catch (error) {
    failure = error;
  }
  await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT kyc_completion_reject');
  await tx.$executeRawUnsafe('RELEASE SAVEPOINT kyc_completion_reject');
  expect(failure).toBeDefined();
}

async function createPendingUpload(tx: Prisma.TransactionClient, intentExpiresAt = uploadExpiry()) {
  const token = randomUUID();
  const owner = await tx.user.create({
    data: {
      email: `kyc-completion-${token}@example.invalid`,
      normalizedEmail: `kyc-completion-${token}@example.invalid`,
      passwordHash: 'test-only-not-a-real-password-hash',
    },
    select: { id: true },
  });
  const other = await tx.user.create({
    data: {
      email: `kyc-other-${token}@example.invalid`,
      normalizedEmail: `kyc-other-${token}@example.invalid`,
      passwordHash: 'test-only-not-a-real-password-hash',
    },
    select: { id: true },
  });
  await tx.investorProfile.create({
    data: { userId: owner.id, firstName: 'Synthetic', lastName: 'Applicant' },
  });
  const profile = await tx.individualKycProfile.create({
    data: { investorUserId: owner.id },
    select: { id: true, version: true },
  });
  const document = await tx.individualKycDocument.create({
    data: {
      kycProfileId: profile.id,
      investorUserId: owner.id,
      documentType: 'PASSPORT',
      storageKey: `individual-kyc/quarantine/${randomUUID()}`,
      originalFilename: 'synthetic.pdf',
      contentType: 'application/pdf',
      sizeBytes: BigInt(1024),
      expectedChecksumSha256: checksum,
      uploadExpiresAt: intentExpiresAt,
    },
    select: { id: true },
  });
  await tx.individualKycProfile.update({ where: { id: profile.id }, data: { version: 1 } });
  await tx.individualKycProfileEvent.create({
    data: {
      kycProfileId: profile.id,
      actorUserId: owner.id,
      eventKind: 'ID_DOCUMENT_UPLOAD_INTENT_CREATED',
      profileVersion: 1,
      relatedDocumentId: document.id,
    },
  });
  return { ownerId: owner.id, otherUserId: other.id, profileId: profile.id, documentId: document.id };
}

async function applyValidCompletion(tx: Prisma.TransactionClient, fixture: Awaited<ReturnType<typeof createPendingUpload>>) {
  const uploadedAt = uploadTime();
  const retentionExpiresAt = retentionExpiry(uploadedAt);
  await tx.$executeRaw`
    UPDATE "individual_kyc_documents"
       SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
           "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
           "storageObjectVersionId" = 'integration-version-0001',
           "uploadedAt" = ${uploadedAt},
           "retentionExpiresAt" = ${retentionExpiresAt}
     WHERE "id" = ${fixture.documentId}::uuid
  `;
  await tx.individualKycProfile.update({ where: { id: fixture.profileId }, data: { version: 2 } });
  return { uploadedAt, retentionExpiresAt };
}

describeDatabase('Individual KYC document-completion database guards', () => {
  beforeAll(async () => {
    assertDestructiveTestDatabaseAllowed(process.env.DATABASE_URL);
    prisma = new PrismaClient();
    await prisma.$connect();
    const identity = await prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity.length !== 1 || identity[0].db !== DESIGNATED_TEST_DATABASE ||
        !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role') {
      await prisma.$disconnect();
      throw new Error('Refusing KYC trigger integration tests: live target is not the isolated local starfetch_test database.');
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('commits the transition and matching applicant Personal-section audit inside the transaction', async () => {
    await withRollback(async (tx) => {
      const fixture = await createPendingUpload(tx);
      const { uploadedAt, retentionExpiresAt } = await applyValidCompletion(tx, fixture);
      await tx.individualKycProfileEvent.create({
        data: {
          kycProfileId: fixture.profileId,
          actorUserId: fixture.ownerId,
          eventKind: 'ID_DOCUMENT_UPLOADED',
          section: 'PERSONAL',
          profileVersion: 2,
          relatedDocumentId: fixture.documentId,
        },
      });
      await tx.$executeRawUnsafe('SET CONSTRAINTS individual_kyc_profile_version_audit_guard IMMEDIATE');

      const document = await tx.individualKycDocument.findUniqueOrThrow({ where: { id: fixture.documentId } });
      expect(document).toMatchObject({
        status: 'UNDER_REVIEW',
        manualReviewStatus: 'UNDER_REVIEW',
        scanStatus: 'PENDING',
        scannerVersion: null,
        storageObjectVersionId: 'integration-version-0001',
        expectedChecksumSha256: checksum,
        uploadedAt,
        retentionExpiresAt,
        scanCompletedAt: null,
        scanSha256: null,
        scanAttestationDigest: null,
      });
      const event = await tx.individualKycProfileEvent.findFirstOrThrow({
        where: { kycProfileId: fixture.profileId, profileVersion: 2 },
      });
      expect(event).toMatchObject({
        actorUserId: fixture.ownerId,
        eventKind: 'ID_DOCUMENT_UPLOADED',
        section: 'PERSONAL',
        relatedDocumentId: fixture.documentId,
      });
    });
  });

  it('rejects scan/approval shortcuts, incomplete versions, expired intents and excessive retention', async () => {
    await withRollback(async (tx) => {
      const fixture = await createPendingUpload(tx);
      const now = uploadTime();
      const expiry = retentionExpiry(now);

      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UPLOADED'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'ACCEPTED'::"ManualDocumentReviewStatus",
               "scanStatus" = 'CLEAN'::"IndividualKycDocumentScanStatus",
               "scannerVersion" = 'forged-scanner', "uploadedAt" = ${now},
               "storageObjectVersionId" = 'version-unauthorized', "retentionExpiresAt" = ${expiry}
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
               "storageObjectVersionId" = NULL, "uploadedAt" = ${now}, "retentionExpiresAt" = ${expiry}
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'ACCEPTED'::"ManualDocumentReviewStatus",
               "storageObjectVersionId" = 'version-invalid-review', "uploadedAt" = ${now}, "retentionExpiresAt" = ${expiry}
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
               "storageObjectVersionId" = 'version-missing-upload-time', "uploadedAt" = NULL, "retentionExpiresAt" = ${expiry}
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
               "storageObjectVersionId" = 'version-missing-retention', "uploadedAt" = ${now}, "retentionExpiresAt" = NULL
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
               "storageObjectVersionId" = 'null', "uploadedAt" = ${now}, "retentionExpiresAt" = ${expiry}
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
               "scanStatus" = 'CLEAN'::"IndividualKycDocumentScanStatus",
               "scannerVersion" = 'forged-scanner', "scanCompletedAt" = ${now},
               "scanSha256" = ${checksum}, "scanAttestationDigest" = ${'a'.repeat(64)},
               "storageObjectVersionId" = 'version-scan-shortcut', "uploadedAt" = ${now}, "retentionExpiresAt" = ${expiry}
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
               "storageObjectVersionId" = 'version-excessive-retention', "uploadedAt" = ${now},
               "retentionExpiresAt" = ${new Date(now.getTime() + 3651 * 24 * 60 * 60 * 1000)}
         WHERE "id" = ${fixture.documentId}::uuid
      `);
      const expiredFixture = await createPendingUpload(tx, new Date(Date.now() - 60_000));
      await expectRejectedWithinSavepoint(tx, () => tx.$executeRaw`
        UPDATE "individual_kyc_documents"
           SET "status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus",
               "manualReviewStatus" = 'UNDER_REVIEW'::"ManualDocumentReviewStatus",
               "storageObjectVersionId" = 'version-expired-intent', "uploadedAt" = ${now}, "retentionExpiresAt" = ${expiry}
         WHERE "id" = ${expiredFixture.documentId}::uuid
      `);
      const unchanged = await tx.individualKycDocument.findUniqueOrThrow({ where: { id: fixture.documentId } });
      expect(unchanged).toMatchObject({ status: 'PENDING_UPLOAD', manualReviewStatus: 'NOT_REVIEWED', storageObjectVersionId: null, uploadedAt: null });
    });
  });

  it('rejects upload audit events for a non-Personal section, another user, or no document reference', async () => {
    await withRollback(async (tx) => {
      const fixture = await createPendingUpload(tx);
      await applyValidCompletion(tx, fixture);
      const eventBase = {
        kycProfileId: fixture.profileId,
        eventKind: 'ID_DOCUMENT_UPLOADED' as const,
        profileVersion: 2,
        relatedDocumentId: fixture.documentId,
      };
      await expectRejectedWithinSavepoint(tx, () => tx.individualKycProfileEvent.create({
        data: { ...eventBase, actorUserId: fixture.ownerId, section: 'BANK' },
      }));
      await expectRejectedWithinSavepoint(tx, () => tx.individualKycProfileEvent.create({
        data: { ...eventBase, actorUserId: fixture.otherUserId, section: 'PERSONAL' },
      }));
      await expectRejectedWithinSavepoint(tx, () => tx.individualKycProfileEvent.create({
        data: { ...eventBase, actorUserId: fixture.ownerId, section: 'PERSONAL', relatedDocumentId: null },
      }));
    });
  });
});
