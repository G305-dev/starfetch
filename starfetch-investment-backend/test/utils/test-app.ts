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
  } = {},
): Promise<TestApp> {
  const mailer = new FakeEmailProvider();
  const jointMailer = new FakeJointInvitationMailer();
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule, ...(extras.imports ?? [])],
    controllers: extras.controllers ?? [],
  })
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
  // Phase 3B joint tables first (children of users/joint_accounts). The
  // joint-account row is deleted AFTER portfolios:Portfolio→JointAccount is
  // ON DELETE RESTRICT by design.
  await prisma.jointAccountInvitation.deleteMany();
  await prisma.jointAccountMember.deleteMany();
  await prisma.holding.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.jointAccount.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.emailVerificationChallenge.deleteMany();
  await prisma.investorProfile.deleteMany();
  await prisma.user.deleteMany();
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
