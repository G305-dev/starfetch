import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { EMAIL_PROVIDER } from '../../src/modules/auth/email/email-provider';
import { FakeEmailProvider } from '../../src/modules/auth/email/fake-email.provider';

export const REFRESH_COOKIE = 'sf_refresh';
export const CSRF_COOKIE = 'sf_csrf';

export interface TestApp {
  app: INestApplication;
  server: any; // supertest App (http.Server)
  prisma: PrismaService;
  mailer: FakeEmailProvider;
}

/** Boots the real AppModule with the EMAIL_PROVIDER driven to the test fake. */
export async function createTestApp(): Promise<TestApp> {
  const mailer = new FakeEmailProvider();
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMAIL_PROVIDER)
    .useValue(mailer)
    .compile();

  const app = moduleFixture.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();

  return { app, server: app.getHttpServer(), prisma: moduleFixture.get(PrismaService), mailer };
}

/** Removes all identity rows in FK-safe order (test isolation). */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
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
