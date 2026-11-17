import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  IsolatedMemoryIndividualKycDocumentStorage,
} from '../src/modules/individual-kyc/individual-kyc-document-ports';
import { TestIndividualKycEncryptionProvider } from '../src/modules/individual-kyc/individual-kyc-encryption';
import { IndividualKycService } from '../src/modules/individual-kyc/individual-kyc.service';
import {
  BankDetailsKycSectionDto, InvestmentProfileKycSectionDto, PersonalKycSectionDto,
  SourceOfFundsKycSectionDto,
} from '../src/modules/individual-kyc/dto/individual-kyc.dto';
import {
  assertDestructiveTestDatabaseAllowed, DESIGNATED_TEST_DATABASE,
} from './utils/e2e-db-guard';

const enabled = process.env.RUN_INDIVIDUAL_KYC_DB_INTEGRATION === '1';
const describeDatabase = enabled ? describe : describe.skip;
const checksum = `${'A'.repeat(43)}=`;

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

function transactionBackedClient(tx: Prisma.TransactionClient): any {
  let proxy: any;
  proxy = new Proxy(tx as any, {
    get(target, property) {
      if (property === '$transaction') return (work: (client: any) => Promise<unknown>) => work(proxy);
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return proxy;
}

async function createProfileAndReviewedDocument(tx: Prisma.TransactionClient) {
  const token = randomUUID();
  const email = `kyc-persistence-${token}@example.invalid`;
  const user = await tx.user.create({
    data: { email, normalizedEmail: email, passwordHash: 'test-only-not-a-real-password-hash' },
    select: { id: true },
  });
  await tx.investorProfile.create({ data: { userId: user.id, firstName: 'Synthetic', lastName: 'Applicant' } });
  const profile = await tx.individualKycProfile.create({
    data: { investorUserId: user.id }, select: { id: true },
  });
  const documentId = randomUUID();
  const uploadExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await tx.individualKycDocument.create({
    data: {
      id: documentId, kycProfileId: profile.id, investorUserId: user.id,
      documentType: 'PASSPORT', storageKey: `individual-kyc/quarantine/${randomUUID()}`,
      originalFilename: 'synthetic.pdf', contentType: 'application/pdf', sizeBytes: BigInt(1024),
      expectedChecksumSha256: checksum, uploadExpiresAt,
    },
  });
  // Ensure upload time is after the database-created document timestamp while
  // remaining inside the allowed current-time tolerance and live intent.
  const uploadedAt = new Date(Date.now() + 30_000);
  const retentionExpiresAt = new Date(uploadedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
  await tx.individualKycProfile.update({ where: { id: profile.id }, data: { version: 1 } });
  await tx.individualKycProfileEvent.create({
    data: { kycProfileId: profile.id, actorUserId: user.id,
      eventKind: 'ID_DOCUMENT_UPLOAD_INTENT_CREATED', profileVersion: 1, relatedDocumentId: documentId },
  });
  await tx.individualKycDocument.update({
    where: { id: documentId }, data: {
      status: 'UNDER_REVIEW', manualReviewStatus: 'UNDER_REVIEW',
      storageObjectVersionId: `synthetic-version-${token}`, uploadedAt, retentionExpiresAt,
    },
  });
  await tx.individualKycProfile.update({ where: { id: profile.id }, data: { version: 2 } });
  await tx.individualKycProfileEvent.create({
    data: { kycProfileId: profile.id, actorUserId: user.id, eventKind: 'ID_DOCUMENT_UPLOADED',
      section: 'PERSONAL', profileVersion: 2, relatedDocumentId: documentId },
  });
  return { userId: user.id, profileId: profile.id, documentId };
}

describeDatabase('Individual KYC encrypted persistence and submission (local PostgreSQL)', () => {
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
      throw new Error('Refusing KYC persistence integration test: target is not isolated local starfetch_test.');
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('saves encrypted sections, reloads them and their statuses, then durably submits without approval', async () => {
    await withRollback(async (tx) => {
      const fixture = await createProfileAndReviewedDocument(tx);
      const service = new IndividualKycService(
        transactionBackedClient(tx),
        { get: () => 365 } as any,
        new TestIndividualKycEncryptionProvider('test', Buffer.alloc(32, 41)),
        new IsolatedMemoryIndividualKycDocumentStorage('test'),
      );

      let version = 2;
      version = (await service.savePersonal(fixture.userId, Object.assign(new PersonalKycSectionDto(), {
        version, dateOfBirth: '1990-01-01', gender: 'FEMALE', nationality: 'NG',
        stateOfResidence: 'Lagos', residentialAddress: 'Synthetic address', idDocumentType: 'PASSPORT',
        occupation: 'Analyst', pepStatus: 'NO',
      }))).version;
      version = (await service.saveInvestment(fixture.userId, Object.assign(new InvestmentProfileKycSectionDto(), {
        version, primaryInvestmentObjective: 'Capital preservation', riskTolerance: 'Moderate',
        investmentHorizon: 'DAYS_180', financialCurrency: 'NGN', investmentKnowledgeExperience: 'Good',
        expectedWithdrawalsMinor: '500000', annualIncomeMinor: '10000000', estimatedNetWorthMinor: '30000000',
        withdrawalFrequency: 'Every six months',
      }))).version;
      version = (await service.saveSourceOfFunds(fixture.userId, Object.assign(new SourceOfFundsKycSectionDto(), {
        version, sourceOfFunds: ['Salary / employment', 'Other (specify)'], otherSource: 'Synthetic declared source',
        expectedAnnualInflowMinor: '5000000', expectedTransactionFrequency: 'About monthly',
      }))).version;
      version = (await service.saveBankDetails(fixture.userId, Object.assign(new BankDetailsKycSectionDto(), {
        version, bankName: 'Synthetic Bank', accountNumber: '0123456789', accountName: 'Synthetic Applicant',
        accountType: 'Current account', bvnLinkedToAccount: true,
      }))).version;

      const before = await service.getOwn(fixture.userId);
      expect(before.sectionStatuses).toEqual({
        personal: 'COMPLETE', investment: 'COMPLETE', sourceOfFunds: 'COMPLETE', bank: 'COMPLETE',
      });
      expect(before.progression).toEqual({ nextSection: null, canSubmit: true });
      expect((before.sections as any).bankDetails).toMatchObject({ accountNumberMasked: '******6789' });
      expect(JSON.stringify(before)).not.toContain('0123456789');
      const encryptedRow = await tx.individualKycProfile.findUniqueOrThrow({ where: { id: fixture.profileId } });
      expect(encryptedRow.encryptedPayload).toBeTruthy();
      expect(encryptedRow.encryptedPayload).not.toContain('0123456789');
      expect(encryptedRow.encryptionKeyProvider).toBe('TEST_AES_GCM');
      expect(encryptedRow).toMatchObject({ status: 'DRAFT', version });

      const result = await service.submit(fixture.userId, version);
      expect(result.status).toBe('SUBMITTED');
      await tx.$executeRawUnsafe('SET CONSTRAINTS individual_kyc_profile_version_audit_guard IMMEDIATE');
      const persisted = await tx.individualKycProfile.findUniqueOrThrow({ where: { id: fixture.profileId } });
      expect(persisted).toMatchObject({
        status: 'SUBMITTED', version: version + 1,
        personalSectionStatus: 'COMPLETE', investmentSectionStatus: 'COMPLETE',
        sourceOfFundsSectionStatus: 'COMPLETE', bankSectionStatus: 'COMPLETE',
        approvedAt: null, approvedByUserId: null,
      });
      expect(persisted.submittedAt).toBeInstanceOf(Date);
      const submitEvent = await tx.individualKycProfileEvent.findFirstOrThrow({
        where: { kycProfileId: fixture.profileId, profileVersion: version + 1 },
      });
      expect(submitEvent).toMatchObject({ actorUserId: fixture.userId, eventKind: 'SUBMITTED' });
      const afterRefresh = await service.getOwn(fixture.userId);
      expect(afterRefresh.status).toBe('SUBMITTED');
      expect(afterRefresh.sectionStatuses).toEqual(before.sectionStatuses);
      expect((afterRefresh.sections as any).investmentProfile.primaryInvestmentObjective).toBe('CAPITAL_PRESERVATION');
      expect((afterRefresh.sections as any).sourceOfFunds.sourceOfFunds).toEqual(['SALARY_EMPLOYMENT', 'OTHER']);
      const document = await tx.individualKycDocument.findUniqueOrThrow({ where: { id: fixture.documentId } });
      expect(document).toMatchObject({ status: 'UNDER_REVIEW', manualReviewStatus: 'UNDER_REVIEW', scanStatus: 'PENDING' });
    });
  });
});
