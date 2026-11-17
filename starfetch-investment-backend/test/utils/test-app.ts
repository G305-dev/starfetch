import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EMAIL_PROVIDER } from '../../src/modules/auth/email/email-provider';
import { FakeEmailProvider } from '../../src/modules/auth/email/fake-email.provider';
import { FakeJointInvitationMailer } from '../../src/modules/joint/email/fake-invitation-mailer';
import { JOINT_INVITATION_MAILER } from '../../src/modules/joint/email/joint-invitation-mailer';
import { assertDestructiveTestDatabaseAllowed } from './e2e-db-guard';

export const REFRESH_COOKIE = 'sf_refresh';
export const CSRF_COOKIE = 'sf_csrf';

const TEST_RESET_APPEND_ONLY_GUARDS = [
  ['corporate_details_revisions', 'corporate_details_revisions_immutable_trigger'],
  ['verification_consent_events', 'verification_consent_events_immutable_trigger'],
  ['provider_verification_attempts', 'provider_verification_attempts_immutable_trigger'],
  ['provider_verification_evidence_events', 'provider_verification_evidence_events_immutable_trigger'],
  ['verification_documents', 'verification_documents_immutable_trigger'],
  ['verification_document_events', 'verification_document_events_immutable_trigger'],
  ['application_staff_review_events', 'application_staff_review_events_immutable_trigger'],
  ['onboarding_application_history', 'onboarding_application_history_no_mutation_trigger'],
] as const;

const TEST_RESET_TRUNCATE_GUARDS = [
  ['joint_account_members', 'joint_account_members_no_truncate_trigger'],
  ['verification_rulesets', 'verification_rulesets_no_truncate_trigger'],
  ['verification_ruleset_versions', 'verification_ruleset_versions_no_truncate_trigger'],
  ['verification_subject_definitions', 'verification_subject_definitions_no_truncate_trigger'],
  ['verification_check_definitions', 'verification_check_definitions_no_truncate_trigger'],
  ['accepted_evidence_source_definitions', 'accepted_evidence_source_definitions_no_truncate_trigger'],
  ['conditional_document_requirement_definitions', 'conditional_document_requirement_definitions_no_truncate_trigger'],
  ['onboarding_application_ruleset_bindings', 'onboarding_application_ruleset_bindings_no_truncate_trigger'],
  ['application_ruleset_binding_events', 'application_ruleset_binding_events_no_truncate_trigger'],
  ['onboarding_application_ruleset_pins', 'onboarding_application_ruleset_pins_no_truncate_trigger'],
  ['application_verification_snapshots', 'application_verification_snapshots_no_truncate_trigger'],
  ['application_verification_subject_snapshots', 'application_verification_subject_snapshots_no_truncate_trigger'],
  ['application_verification_requirements', 'application_verification_requirements_no_truncate_trigger'],
  ['verification_consent_events', 'verification_consent_events_no_truncate_trigger'],
  ['provider_verification_attempts', 'provider_verification_attempts_no_truncate_trigger'],
  ['provider_verification_evidence_events', 'provider_verification_evidence_events_no_truncate_trigger'],
  ['verification_documents', 'verification_documents_no_truncate_trigger'],
  ['verification_document_events', 'verification_document_events_no_truncate_trigger'],
  ['application_staff_review_events', 'application_staff_review_events_no_truncate_trigger'],
] as const;

export interface TestApp {
  app: INestApplication;
  server: any; // supertest App (http.Server)
  prisma: PrismaService;
  mailer: FakeEmailProvider;
  jointMailer: FakeJointInvitationMailer;
}

/** Boots the real AppModule with the EMAIL_PROVIDER driven to the test fake.
 * `extras.controllers` mounts test-only probe controllers (e.g. guard security
 * probes) — production routes are never modified by this hook. */
export async function createTestApp(
  extras: {
    controllers?: Parameters<typeof Test.createTestingModule>[0]['controllers'];
    imports?: Parameters<typeof Test.createTestingModule>[0]['imports'];
    providerOverrides?: Array<{ provide: unknown; useValue: unknown }>;
  } = {},
): Promise<TestApp> {
  const mailer = new FakeEmailProvider();
  const jointMailer = new FakeJointInvitationMailer();
  let builder = Test.createTestingModule({
    imports: [AppModule, ...(extras.imports ?? [])],
    controllers: extras.controllers ?? [],
  });
  for (const override of extras.providerOverrides ?? []) {
    builder = builder.overrideProvider(override.provide as any).useValue(override.useValue);
  }
  const moduleFixture: TestingModule = await builder
    .overrideProvider(EMAIL_PROVIDER)
    .useValue(mailer)
    .overrideProvider(JOINT_INVITATION_MAILER)
    .useValue(jointMailer)
    .compile();

  const app = moduleFixture.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();

  return {
    app,
    server: app.getHttpServer(),
    prisma: moduleFixture.get(PrismaService),
    mailer,
    jointMailer,
  };
}

/** Removes all identity rows in FK-safe order (test isolation).
 * FAIL-CLOSED pre-merge safeguard: refuses to run unless the resolved
 * DATABASE_URL is the designated local starfetch_test database. */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  assertDestructiveTestDatabaseAllowed(process.env.DATABASE_URL);
  await prisma.$transaction(async (tx) => {
    // URL shape is only a precondition. Confirm the live PostgreSQL endpoint's
    // identity on this transaction connection before any destructive statement.
    const identity = await tx.$queryRaw<Array<{ db: string; host: string; db_user: string }>>`
      SELECT current_database() AS db, host(inet_server_addr()) AS host, current_user AS db_user
    `;
    if (
      identity.length !== 1 ||
      identity[0].db !== 'starfetch_test' ||
      !['127.0.0.1', '::1'].includes(identity[0].host) ||
      identity[0].db_user !== 'starfetch_test_role'
    ) {
      throw new Error('Refusing cleanup: live PostgreSQL identity is not the designated isolated starfetch_test target.');
    }

    // This helper is the only exception to the database TRUNCATE guards. It
    // runs solely after live DB identity verification inside this isolated test
    // transaction. These identifiers are compile-time constants, never input.
    for (const [table, trigger] of TEST_RESET_APPEND_ONLY_GUARDS) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER "${trigger}"`);
    }
    for (const [table, trigger] of TEST_RESET_TRUNCATE_GUARDS) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER "${trigger}"`);
    }

    // Newly protected provider/document/review rows must be deleted child-first
    // inside this identity-verified isolated-test transaction before their
    // immutable requirement/snapshot parents are reset.
    await tx.providerVerificationEvidenceEvent.deleteMany();
    await tx.providerVerificationAttempt.deleteMany();
    await tx.verificationConsentEvent.deleteMany();
    await tx.applicationStaffReviewEvent.deleteMany();
    await tx.verificationDocumentEvent.deleteMany();
    await tx.verificationDocument.deleteMany();

    // Keep all cleanup in one transaction. The canonical-details guard is
    // deferred until commit; deleting the detail row and then its application
    // atomically satisfies that invariant without weakening the production DB
    // constraint or leaving partially-cleaned test state.
    // Published synthetic versions are immutable by row triggers. TRUNCATE is
    // confined to this positively-identified local test DB reset; all tables
    // that reference one another are listed together to retain FK checks.
    await tx.$executeRaw`TRUNCATE TABLE
      "provider_verification_evidence_events",
      "provider_verification_attempts",
      "verification_consent_events",
      "verification_document_events",
      "verification_documents",
      "application_staff_review_events",
      "application_verification_requirements",
      "application_verification_subject_snapshots",
      "application_verification_snapshots",
      "application_ruleset_binding_events",
      "onboarding_application_ruleset_pins",
      "onboarding_application_ruleset_bindings",
      "accepted_evidence_source_definitions",
      "verification_check_definitions",
      "verification_subject_definitions",
      "conditional_document_requirement_definitions",
      "verification_ruleset_versions",
      "verification_rulesets"
    `;
    for (const [table, trigger] of TEST_RESET_TRUNCATE_GUARDS) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER "${trigger}"`);
    }
    await tx.corporateDraftIdempotencyKey.deleteMany();
    await tx.corporateDraftCreation.deleteMany();
    await tx.onboardingApplicationHistory.deleteMany();
    await tx.corporateDetailsRevision.deleteMany();
    await tx.corporateOnboardingDetails.deleteMany();
    await tx.onboardingApplication.deleteMany();
    await tx.corporateAccount.deleteMany();

    // Phase 3B joint tables first (children of users/joint_accounts). The
    // joint-account row is deleted AFTER portfolios:Portfolio→JointAccount is
    // ON DELETE RESTRICT by design.
    await tx.jointAccountInvitation.deleteMany();
    await tx.jointAccountMember.deleteMany();
    await tx.holding.deleteMany();
    await tx.transaction.deleteMany();
    await tx.portfolio.deleteMany();
    await tx.jointAccount.deleteMany();
    await tx.refreshToken.deleteMany();
    await tx.authSession.deleteMany();
    await tx.emailVerificationChallenge.deleteMany();
    await tx.investorProfile.deleteMany();
    await tx.user.deleteMany();
    for (const [table, trigger] of TEST_RESET_APPEND_ONLY_GUARDS) {
      await tx.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER "${trigger}"`);
    }
  }, { maxWait: 5_000, timeout: 60_000 });
}

export interface ParsedCookie {
  value: string;
  flags: string;
}

/** name → { value, raw-flag-string } from a supertest response's Set-Cookie. */
export function cookieJar(res: Response): Map<string, ParsedCookie> {
  const jar = new Map<string, ParsedCookie>();
  const headers = res.headers['set-cookie'] as unknown as string[] | undefined;
  for (const header of headers ?? []) {
    const [pair, ...flags] = header.split(';');
    const eq = pair.indexOf('=');
    jar.set(pair.slice(0, eq).trim(), {
      value: decodeURIComponent(pair.slice(eq + 1).trim()),
      flags: flags.join(';'),
    });
  }
  return jar;
}
