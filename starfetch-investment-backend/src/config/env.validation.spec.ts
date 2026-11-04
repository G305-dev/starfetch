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
    expect(() =>
      validateEnv(
        base({
          NODE_ENV: 'production',
          SMTP_HOST: 'smtp.internal',
          JOINT_INVITATIONS_URL: 'https://app.starfetch.ng/login',
        }),
      ),
    ).not.toThrow();
  });

  it('rejects invalid NODE_ENV and PORT', () => {
    expect(() => validateEnv(base({ NODE_ENV: 'banana' }))).toThrow(/NODE_ENV/);
    expect(() => validateEnv(base({ PORT: '99999' }))).toThrow(/PORT/);
  });

  // ── Phase 3B — joint invitation configuration (Step-4 corrections) ────────

  it('JOINT_INVITATION_TTL_HOURS: rejects zero/negative/NaN/Infinity/unbounded values', () => {
    for (const bad of ['0', '-1', 'abc', 'Infinity', '-Infinity', '720.5', '721', '1000000']) {
      expect(() => validateEnv(base({ JOINT_INVITATION_TTL_HOURS: bad }))).toThrow(
        /JOINT_INVITATION_TTL_HOURS/,
      );
    }
  });

  it('JOINT_INVITATION_TTL_HOURS: accepts bounded positive values; defaults preserved in dev when unset', () => {
    for (const good of ['1', '168', '720']) {
      expect(validateEnv(base({ JOINT_INVITATION_TTL_HOURS: good })).JOINT_INVITATION_TTL_HOURS).toBe(good);
    }
    const env = validateEnv(base({}));
    expect(env.JOINT_INVITATION_TTL_HOURS).toBeUndefined(); // dev default (168h) applied in configuration.ts
  });

  it('JOINT_INVITATIONS_URL: rejects non-URL / wrong scheme / query / fragment / embedded credentials', () => {
    for (const bad of [
      'not a url',
      'ftp://app.starfetch.ng/login',
      'https://app.starfetch.ng/login?token=abc',
      'https://app.starfetch.ng/login#frag',
      'https://user:pass@app.starfetch.ng/login',
    ]) {
      expect(() => validateEnv(base({ JOINT_INVITATIONS_URL: bad }))).toThrow(/JOINT_INVITATIONS_URL/);
    }
  });

  it('JOINT_INVITATIONS_URL: http localhost is fine in DEVELOPMENT only; HTTPS+set required in production', () => {
    expect(
      validateEnv(base({ NODE_ENV: 'development', JOINT_INVITATIONS_URL: 'http://localhost:3000/login' }))
        .JOINT_INVITATIONS_URL,
    ).toBe('http://localhost:3000/login');

    expect(() => validateEnv(base({ NODE_ENV: 'production', SMTP_HOST: 'smtp.internal' }))).toThrow(
      /JOINT_INVITATIONS_URL/, // required, explicit
    );
    expect(() =>
      validateEnv(
        base({ NODE_ENV: 'production', SMTP_HOST: 'smtp.internal', JOINT_INVITATIONS_URL: 'http://app.starfetch.ng/login' }),
      ),
    ).toThrow(/HTTPS/);
    expect(() =>
      validateEnv(
        base({
          NODE_ENV: 'production',
          SMTP_HOST: 'smtp.internal',
          JOINT_INVITATIONS_URL: 'https://localhost/login',
        }),
      ),
    ).toThrow(/localhost/);
    expect(() =>
      validateEnv(
        base({
          NODE_ENV: 'production',
          SMTP_HOST: 'smtp.internal',
          JOINT_INVITATIONS_URL: 'https://app.starfetch.ng/login',
        }),
      ),
    ).not.toThrow();
  });
});
