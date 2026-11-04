/**
 * Pre-merge safeguard — destructive E2E cleanup is FUSED to the designated
 * local test database. `cleanDatabase` (and anything that truncates) must call
 * {@link assertDestructiveTestDatabaseAllowed} FIRST; any other target —
 * starfetch_dev, Neon, a staging/production URL, another host — is refused.
 *
 * The check validates the ACTUAL database target parsed from the resolved
 * DATABASE_URL (scheme + loopback host + exact database name) — NODE_ENV is
 * NOT considered proof, because inherited/mistyped env values are exactly the
 * failure mode this fuse exists to catch.
 */

/** Designated destructive-cleanup database name — the ONLY allowed one. */
export const DESIGNATED_TEST_DATABASE = 'starfetch_test';

/** Loopback hosts considered local. */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export class UnsafeTestDatabaseError extends Error {
  constructor(reason: string) {
    super(
      `Refusing destructive E2E database cleanup: ${reason}. ` +
        `Cleanup is fused to postgresql://<loopback>/${DESIGNATED_TEST_DATABASE}.`,
    );
    this.name = 'UnsafeTestDatabaseError';
  }
}

export function assertDestructiveTestDatabaseAllowed(databaseUrl: string | undefined): void {
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    throw new UnsafeTestDatabaseError('DATABASE_URL is not set');
  }
  let url: URL;
  try {
    url = new URL(databaseUrl.trim());
  } catch {
    throw new UnsafeTestDatabaseError('DATABASE_URL is not a parseable URL');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new UnsafeTestDatabaseError(`URL scheme '${url.protocol}' is not PostgreSQL`);
  }
  const host = url.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new UnsafeTestDatabaseError(
      `database host '${url.hostname}' is not loopback — possibly a shared/managed (e.g. Neon) target`,
    );
  }
  const dbName = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  if (dbName !== DESIGNATED_TEST_DATABASE) {
    throw new UnsafeTestDatabaseError(
      `database '${dbName}' is not the designated '${DESIGNATED_TEST_DATABASE}'`,
    );
  }
}
