/**
 * Jest e2e environment bootstrap (runs before any spec module loads).
 * Provides SAFE test defaults; real environment variables always win (??=).
 *
 * DATABASE_URL points at a dedicated TEST database (`starfetch_test`) — the
 * suite truncates identity tables between tests. Create it locally with:
 *   createdb -U <your_user> starfetch_test && npx prisma migrate deploy
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://starfetch:starfetch_sandbox_local_pw@127.0.0.1:5432/starfetch_test';
process.env.JWT_ACCESS_SECRET ??= 'test-only-jwt-access-secret-48digits-for-e2e-0123456789abc';
process.env.CSRF_HMAC_SECRET ??= 'test-only-csrf-hmac-secret-48digits-for-e2e-0123456789abc';
process.env.EMAIL_VERIFICATION_HMAC_SECRET ??= 'test-only-email-hmac-secret-48digits-for-e2e-012345678';
process.env.ACCESS_TOKEN_TTL_SECONDS ??= '900';
process.env.REFRESH_TOKEN_TTL_SECONDS ??= '604800';
process.env.REFRESH_IDLE_TTL_SECONDS ??= '86400';
process.env.CORS_ORIGINS ??= 'http://localhost:3000';
// Throttling is disabled for the main e2e flow (deterministic); the dedicated
// rate-limit spec re-enables it explicitly.
process.env.RATE_LIMIT_ENABLED ??= 'false';
