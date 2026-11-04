import {
  DESIGNATED_TEST_DATABASE,
  UnsafeTestDatabaseError,
  assertDestructiveTestDatabaseAllowed,
} from './utils/e2e-db-guard';
import { cleanDatabase } from './utils/test-app';
import { createTestApp, TestApp } from './utils/test-app';

/**
 * Pre-merge safeguard 1 — destructive E2E cleanup is fused to the designated
 * local starfetch_test database. Negative proofs: dev/Neon/other targets can
 * NEVER be cleaned; positive proof: the real suite still cleans the correct DB.
 */
describe('E2E database cleanup fuse (fail-closed)', () => {
  const SAFE = 'postgresql://starfetch:pw@127.0.0.1:5432/starfetch_test';

  describe('assertDestructiveTestDatabaseAllowed — target validation, not NODE_ENV', () => {
    it('accepts ONLY the designated loopback starfetch_test URL', () => {
      expect(() => assertDestructiveTestDatabaseAllowed(SAFE)).not.toThrow();
      expect(() =>
        assertDestructiveTestDatabaseAllowed('postgresql://starfetch:pw@localhost:5432/starfetch_test'),
      ).not.toThrow();
    });

    it('rejects the development database name', () => {
      expect(() =>
        assertDestructiveTestDatabaseAllowed('postgresql://starfetch:pw@127.0.0.1:5432/starfetch_dev'),
      ).toThrow(UnsafeTestDatabaseError);
    });

    it('rejects Neon / managed-cloud targets even with the right-looking name', () => {
      expect(() =>
        assertDestructiveTestDatabaseAllowed(
          'postgresql://user:pw@ep-cool-dawn-123.us-east-2.aws.neon.tech/starfetch_test?sslmode=require',
        ),
      ).toThrow(/Neon|loopback/i);
    });

    it('rejects non-loopback LAN hosts, wrong schemes, empty, unparseable and database-less URLs', () => {
      const bad: Array<string | undefined> = [
        'postgresql://u:p@192.168.1.5:5432/starfetch_test',
        'postgresql://u:p@db.internal:5432/starfetch_test',
        'mysql://u:p@127.0.0.1:3306/starfetch_test',
        '',
        undefined,
        'not-a-url',
        'starfetch_test',
        'postgresql://u:p@127.0.0.1:5432/', // no database segment
        'postgresql://u:p@127.0.0.1:5432/STARFETCH_TEST', // exact-name check (DB names are case-sensitive)
      ];
      for (const url of bad) {
        expect(() => assertDestructiveTestDatabaseAllowed(url)).toThrow(UnsafeTestDatabaseError);
      }
    });

    it('NODE_ENV is irrelevant: even with NODE_ENV=test, an unsafe target is refused', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(() =>
        assertDestructiveTestDatabaseAllowed('postgresql://u:p@127.0.0.1:5432/starfetch_dev'),
      ).toThrow(UnsafeTestDatabaseError);
    });
  });

  describe('cleanDatabase — refuses to run against an inherited/mistyped DATABASE_URL', () => {
    let t: TestApp | undefined;
    const originalUrl = process.env.DATABASE_URL;

    afterAll(async () => {
      process.env.DATABASE_URL = originalUrl;
      if (t) {
        await cleanDatabase(t.prisma);
        await t.app.close();
      }
    }, 30_000);

    it('cleanDatabase throws UnsafeTestDatabaseError for starfetch_dev BEFORE touching any table', async () => {
      // The app itself must boot on the SAFE database; we then simulate the
      // dangerous inheritance and prove cleanup refuses (no row deleted).
      t = await createTestApp();
      const marker = await t.prisma.user.create({
        data: { email: 'fuse@starfetch.dev', normalizedEmail: 'fuse@starfetch.dev', passwordHash: 'x' },
      });

      process.env.DATABASE_URL = 'postgresql://starfetch:pw@127.0.0.1:5432/starfetch_dev';
      await expect(cleanDatabase(t.prisma)).rejects.toThrow(UnsafeTestDatabaseError);

      process.env.DATABASE_URL = 'postgresql://user:pw@ep-x.eu-central-1.aws.neon.tech/neondb';
      await expect(cleanDatabase(t.prisma)).rejects.toThrow(UnsafeTestDatabaseError);

      // nothing was deleted while the unsafe targets were set
      expect(await t.prisma.user.findUnique({ where: { id: marker.id } })).not.toBeNull();

      // positive control: restoring the designated URL cleans successfully
      process.env.DATABASE_URL = originalUrl;
      await cleanDatabase(t.prisma);
      expect(await t.prisma.user.findUnique({ where: { id: marker.id } })).toBeNull();
      expect(DESIGNATED_TEST_DATABASE).toBe('starfetch_test');
    }, 60_000);
  });
});
