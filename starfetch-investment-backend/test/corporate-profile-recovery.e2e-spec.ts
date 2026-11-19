import { randomUUID } from 'crypto';
import { OnboardingApplicationHistoryEvent, OnboardingApplicationKind, OnboardingApplicationStatus, PrimaryAccountType, UserRole } from '@prisma/client';
import request from 'supertest';
import { CorporateApplicantContextService } from '../src/modules/corporate-onboarding/services/corporate-applicant-context.service';
import { CorporateProfileService } from '../src/modules/corporate-onboarding/services/corporate-profile.service';
import { TestApp, cleanDatabase, createTestApp } from './utils/test-app';

const PASSWORD = 'a perfectly valid passphrase';

describe('Corporate registration recovery and profile persistence (isolated local PostgreSQL)', () => {
  let t: TestApp;
  let profiles: CorporateProfileService;
  let applicants: CorporateApplicantContextService;
  let databaseIdentityVerified = false;
  let userId: string;
  let corporateAccountId: string;
  let applicationId: string;

  beforeAll(async () => {
    t = await createTestApp();
    profiles = t.app.get(CorporateProfileService);
    applicants = t.app.get(CorporateApplicantContextService);
    const identity = await t.prisma.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (identity.length !== 1 || identity[0].db !== 'starfetch_test' ||
        !['127.0.0.1', '::1'].includes(identity[0].host) || identity[0].db_user !== 'starfetch_test_role') {
      throw new Error('E2E database is not the verified isolated loopback starfetch_test target.');
    }
    databaseIdentityVerified = true;
    await cleanDatabase(t.prisma);
  }, 60_000);

  afterAll(async () => {
    if (t) {
      if (databaseIdentityVerified) await cleanDatabase(t.prisma);
      await t.app.close();
    }
  }, 60_000);

  beforeEach(async () => {
    await cleanDatabase(t.prisma);
    userId = randomUUID();
    const user = await t.prisma.user.create({
      data: {
        id: userId,
        email: `corporate-${userId}@example.invalid`,
        normalizedEmail: `corporate-${userId}@example.invalid`,
        passwordHash: 'synthetic-test-hash-not-used-for-auth',
        role: UserRole.INVESTOR,
        primaryAccountType: PrimaryAccountType.CORPORATE,
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        corporateApplicantProfile: { create: { companyName: 'Synthetic Holdings Ltd', companyPhoneNumber: '+2348000000000' } },
      },
    });
    const corporateAccount = await t.prisma.corporateAccount.create({ data: {} });
    corporateAccountId = corporateAccount.id;
    const application = await t.prisma.$transaction(async (tx) => {
      const created = await tx.onboardingApplication.create({
        data: {
          kind: OnboardingApplicationKind.CORPORATE,
          ownerCorporateAccountId: corporateAccountId,
          initiatingUserId: user.id,
          status: OnboardingApplicationStatus.DRAFT,
          submittedByUserId: null,
          submittedAt: null,
        },
      });
      await tx.corporateOnboardingDetails.create({
        data: {
          applicationId: created.id,
          institutionName: 'Synthetic Holdings Ltd',
          dateOfIncorporation: new Date('2020-01-02T00:00:00.000Z'),
          rcNumber: 'RC-SYNTHETIC-1',
          businessPhoneNumber: '+2348000000000',
          businessEmail: `business-${userId}@example.invalid`,
          version: 1,
        },
      });
      await tx.onboardingApplicationHistory.create({
        data: {
          applicationId: created.id,
          event: OnboardingApplicationHistoryEvent.CREATED,
          fromStatus: null,
          toStatus: OnboardingApplicationStatus.DRAFT,
          actorUserId: user.id,
        },
      });
      return created;
    });
    applicationId = application.id;
  }, 60_000);

  function principal(id = userId) {
    return { userId: id, role: UserRole.INVESTOR, sessionId: randomUUID() };
  }

  it('persists Corporate registration type and the applicant display profile without granting a session', async () => {
    const email = `registered-${randomUUID()}@example.invalid`;
    const response = await request(t.server).post('/api/v1/auth/register').send({
      registrationType: 'CORPORATE', companyName: 'Registration Test Holdings', companyPhoneNumber: '+2348000000000',
      email, password: PASSWORD,
    }).expect(201);
    expect(response.body.data.nextAction).toBe('VERIFY_EMAIL');
    expect(response.headers['set-cookie']).toBeUndefined();
    const user = await t.prisma.user.findUniqueOrThrow({
      where: { id: response.body.data.userId }, include: { investorProfile: true, corporateApplicantProfile: true, authSessions: true },
    });
    expect(user.primaryAccountType).toBe(PrimaryAccountType.CORPORATE);
    expect(user.investorProfile).toBeNull();
    expect(user.corporateApplicantProfile).toMatchObject({ companyName: 'Registration Test Holdings', companyPhoneNumber: '+2348000000000' });
    expect(user.authSessions).toHaveLength(0);
  });

  it('keeps no-evidence legacy users unclassified and requires a two-person audited recovery before Corporate access', async () => {
    const legacyId = randomUUID();
    await t.prisma.user.create({
      data: {
        id: legacyId, email: `legacy-${legacyId}@example.invalid`, normalizedEmail: `legacy-${legacyId}@example.invalid`,
        passwordHash: 'synthetic-test-hash-not-used-for-auth', role: UserRole.INVESTOR,
        emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    const legacyPrincipal = principal(legacyId);
    await expect(applicants.requireVerifiedInvestor(legacyPrincipal)).rejects.toMatchObject({ status: 403 });

    // A direct classification update without an operator audit row is blocked by the migration trigger.
    await expect(t.prisma.$executeRaw`
      UPDATE "users" SET "primaryAccountType" = 'CORPORATE'::"PrimaryAccountType" WHERE "id" = ${legacyId}::uuid
    `).rejects.toThrow();

    const supportCaseId = `RECOVERY-${randomUUID()}`;
    await t.prisma.accountTypeRecoveryAudit.create({ data: {
      userId: legacyId,
      assignedType: PrimaryAccountType.CORPORATE,
      supportCaseId,
      verificationMethod: 'verified historical registration record',
      evidenceReference: `restricted-case:${supportCaseId}`,
      requestedBy: 'support-operator-a',
      approvedBy: 'support-operator-b',
    } });
    await t.prisma.user.update({ where: { id: legacyId }, data: { primaryAccountType: PrimaryAccountType.CORPORATE } });

    const recovered = await t.prisma.user.findUniqueOrThrow({ where: { id: legacyId } });
    const event = await t.prisma.accountTypeRecoveryAudit.findUniqueOrThrow({ where: { userId: legacyId } });
    expect(recovered.primaryAccountType).toBe(PrimaryAccountType.CORPORATE);
    expect(event).toMatchObject({ assignedType: PrimaryAccountType.CORPORATE, supportCaseId, requestedBy: 'support-operator-a', approvedBy: 'support-operator-b' });
    expect(event.appliedAt).toBeInstanceOf(Date);
    await expect(applicants.requireVerifiedInvestor(legacyPrincipal)).resolves.toMatchObject({ initiatingUserId: legacyId });

    // A second classification is forbidden once the primary account family is set.
    await expect(t.prisma.user.update({ where: { id: legacyId }, data: { primaryAccountType: PrimaryAccountType.INDIVIDUAL } })).rejects.toThrow();
  });

  it('saves Company Details transactionally, reloads persisted data and rejects a non-owner', async () => {
    const saved = await profiles.saveCompanyDetails(principal(), corporateAccountId, 0, 1, {
      rcNumber: 'RC-SYNTHETIC-1', dateOfIncorporation: '2020-01-02',
      registeredAddress: '10 Synthetic Road', city: 'Lagos', state: 'Lagos',
    } as any);
    expect(saved.companyDetails).toEqual({ registeredAddress: '10 Synthetic Road', city: 'Lagos', state: 'Lagos' });
    expect(saved.sectionStatuses.companyDetails).toBe('DRAFT'); // no TIN was fabricated or bypassed
    expect(saved.profileVersion).toBe(1);

    const reloaded = await profiles.getByCorporateAccountId(principal(), corporateAccountId);
    expect(reloaded.companyDetails.registeredAddress).toBe('10 Synthetic Road');
    expect(reloaded.profileVersion).toBe(1);

    const otherId = randomUUID();
    await t.prisma.user.create({
      data: {
        id: otherId, email: `other-${otherId}@example.invalid`, normalizedEmail: `other-${otherId}@example.invalid`,
        passwordHash: 'synthetic-test-hash-not-used-for-auth', role: UserRole.INVESTOR,
        primaryAccountType: PrimaryAccountType.CORPORATE, emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
    await expect(profiles.getByCorporateAccountId(principal(otherId), corporateAccountId)).rejects.toMatchObject({ status: 404 });
  });

  it('rejects amendments after submission and does not create or increment a profile', async () => {
    await t.prisma.onboardingApplication.update({
      where: { id: applicationId },
      data: { status: OnboardingApplicationStatus.SUBMITTED, submittedAt: new Date(), submittedByUserId: userId },
    });
    await expect(profiles.saveCompanyDetails(principal(), corporateAccountId, 0, 1, {
      rcNumber: 'RC-SYNTHETIC-1', dateOfIncorporation: '2020-01-02',
      registeredAddress: '20 Rejected Road', city: 'Lagos', state: 'Lagos',
    } as any)).rejects.toMatchObject({ status: 409 });
    expect(await t.prisma.corporateProfile.count({ where: { applicationId } })).toBe(0);
    expect(await t.prisma.corporateProfileRevision.count({ where: { applicationId } })).toBe(0);
  });

  it('serializes a concurrent submit and profile amendment so no save commits after SUBMITTED', async () => {
    const amendment = profiles.saveCompanyDetails(principal(), corporateAccountId, 0, 1, {
      rcNumber: 'RC-SYNTHETIC-1', dateOfIncorporation: '2020-01-02',
      registeredAddress: '30 Concurrent Road', city: 'Lagos', state: 'Lagos',
    } as any).then((value) => ({ kind: 'saved' as const, value }), (error) => ({ kind: 'rejected' as const, error }));
    const submission = t.prisma.onboardingApplication.update({
      where: { id: applicationId },
      data: { status: OnboardingApplicationStatus.SUBMITTED, submittedAt: new Date(), submittedByUserId: userId },
    });
    await submission;
    const result = await amendment;
    const finalApplication = await t.prisma.onboardingApplication.findUniqueOrThrow({ where: { id: applicationId } });
    expect(finalApplication.status).toBe(OnboardingApplicationStatus.SUBMITTED);
    if (result.kind === 'rejected') expect(result.error).toMatchObject({ status: 409 });
    const revisions = await t.prisma.corporateProfileRevision.findMany({ where: { applicationId } });
    expect(revisions.length).toBe(result.kind === 'saved' ? 1 : 0);
    // Whether save or submit wins the row lock, a further amendment is always rejected.
    await expect(profiles.saveCompanyDetails(principal(), corporateAccountId, result.kind === 'saved' ? result.value.profileVersion : 0, 1, {
      rcNumber: 'RC-SYNTHETIC-1', dateOfIncorporation: '2020-01-02',
      registeredAddress: '40 After Submit Road', city: 'Lagos', state: 'Lagos',
    } as any)).rejects.toMatchObject({ status: 409 });
  });
});
