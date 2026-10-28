import { validateEnv } from './env.validation';

const DB = 'postgresql://user:pw@localhost:5432/db';
const STRONG = 's'.repeat(48);

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    DATABASE_URL: DB,
    JWT_ACCESS_SECRET: STRONG,
    CSRF_HMAC_SECRET: STRONG,
    EMAIL_VERIFICATION_HMAC_SECRET: STRONG,
    ...overrides,
  };
}

describe('validateEnv (fail-fast, fail-secure)', () => {
  it('passes with a complete development configuration', () => {
    const env = validateEnv(base({ NODE_ENV: 'development' }));
    expect(env.DATABASE_URL).toBe(DB);
    expect(env.PORT).toBe(4000);
  });

  it('fails when DATABASE_URL is missing (required since Phase 2B)', () => {
    expect(() => validateEnv(base({ DATABASE_URL: '' }))).toThrow(/DATABASE_URL/);
  });

  it('fails on a malformed DATABASE_URL', () => {
    expect(() => validateEnv(base({ DATABASE_URL: 'mysql://nope' }))).toThrow(/DATABASE_URL/);
  });

  it('fails when any auth secret is missing in development', () => {
    expect(() => validateEnv(base({ NODE_ENV: 'development', JWT_ACCESS_SECRET: '' }))).toThrow(
      /JWT_ACCESS_SECRET/,
    );
    expect(() => validateEnv(base({ NODE_ENV: 'development', CSRF_HMAC_SECRET: undefined }))).toThrow(
      /CSRF_HMAC_SECRET/,
    );
    expect(() =>
      validateEnv(base({ NODE_ENV: 'development', EMAIL_VERIFICATION_HMAC_SECRET: ' ' })),
    ).toThrow(/EMAIL_VERIFICATION_HMAC_SECRET/);
  });

  it('production rejects weak or placeholder secrets', () => {
    expect(() =>
      validateEnv(base({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'short' })),
    ).toThrow(/JWT_ACCESS_SECRET/);
    expect(() =>
      validateEnv(base({ NODE_ENV: 'production', CSRF_HMAC_SECRET: 'change-me-placeholder-change-me-xx' })),
    ).toThrow(/CSRF_HMAC_SECRET/);
    expect(() =>
      validateEnv(base({ NODE_ENV: 'staging', EMAIL_VERIFICATION_HMAC_SECRET: 'example-example-example-example' })),
    ).toThrow(/EMAIL_VERIFICATION_HMAC_SECRET/);
  });

  it('production requires SMTP_HOST for real verification delivery', () => {
    expect(() => validateEnv(base({ NODE_ENV: 'production' }))).toThrow(/SMTP_HOST/);
    expect(() => validateEnv(base({ NODE_ENV: 'production', SMTP_HOST: 'smtp.internal' }))).not.toThrow();
  });

  it('rejects invalid NODE_ENV and PORT', () => {
    expect(() => validateEnv(base({ NODE_ENV: 'banana' }))).toThrow(/NODE_ENV/);
    expect(() => validateEnv(base({ PORT: '99999' }))).toThrow(/PORT/);
  });
});
