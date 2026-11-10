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

  it('keeps Corporate O2 disabled by default in production and requires all activation prerequisites', () => {
    const productionBase = base({
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.internal',
      JOINT_INVITATIONS_URL: 'https://app.starfetch.example/login',
    });
    expect(() => validateEnv(productionBase)).not.toThrow();
    expect(() => validateEnv({ ...productionBase, CORPORATE_O2_ENABLED: 'true' }))
      .toThrow(/CORPORATE_O2_LAWFUL_BASIS_APPROVED/);
  });

  it('accepts the O2 switch only with explicit approvals, KMS key and dedicated versioned HMAC keys', () => {
    const hmacKey = Buffer.alloc(32, 0x44).toString('base64');
    expect(() => validateEnv(base({
      CORPORATE_O2_ENABLED: 'true',
      CORPORATE_O2_LAWFUL_BASIS_APPROVED: 'true',
      CORPORATE_O2_PRIVACY_NOTICE_APPROVED: 'true',
      CORPORATE_O2_RETENTION_APPROVED: 'true',
      CORPORATE_O2_KMS_KEY_ID: 'arn:aws:kms:eu-west-1:000000000000:key/synthetic-test-key',
      CORPORATE_O2_KMS_KEY_VERSION: 'kms-v1',
      AWS_REGION: 'eu-west-1',
      CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION: 'hmac-v1',
      CORPORATE_O2_HMAC_KEYS_JSON: JSON.stringify({ 'hmac-v1': hmacKey }),
    }))).not.toThrow();
    expect(() => validateEnv(base({
      CORPORATE_O2_ENABLED: 'true',
      CORPORATE_O2_LAWFUL_BASIS_APPROVED: 'true',
      CORPORATE_O2_PRIVACY_NOTICE_APPROVED: 'true',
      CORPORATE_O2_RETENTION_APPROVED: 'true',
      CORPORATE_O2_KMS_KEY_ID: 'synthetic',
      CORPORATE_O2_KMS_KEY_VERSION: 'kms-v1',
      AWS_REGION: 'eu-west-1',
      CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION: 'hmac-v1',
      CORPORATE_O2_HMAC_KEYS_JSON: '{"hmac-v1":"short"}',
    }))).toThrow(/CORPORATE_O2_HMAC_KEYS_JSON/);
  });

  it('keeps Mono Prove disabled by default and refuses live activation in this sandbox-only change', () => {
    expect(() => validateEnv(base({ MONO_PROVE_ENVIRONMENT: 'live' }))).not.toThrow();
    expect(() => validateEnv(base({
      MONO_PROVE_ENABLED: 'true',
      MONO_PROVE_ENVIRONMENT: 'live',
    }))).toThrow(/MONO_PROVE_ENVIRONMENT must be explicitly set to sandbox/);
  });

  it('requires independent consent/privacy/legal gates, server-only credentials, and an allowlisted sandbox redirect', () => {
    const sandboxMono = {
      MONO_PROVE_ENABLED: 'true',
      MONO_PROVE_ENVIRONMENT: 'sandbox',
      MONO_PROVE_LAWFUL_BASIS_APPROVED: 'true',
      MONO_PROVE_PRIVACY_NOTICE_APPROVED: 'true',
      MONO_PROVE_CONSENT_TEXT_APPROVED: 'true',
      MONO_PROVE_CONSENT_TEXT_VERSION: 'approved-v1',
      MONO_PROVE_CONSENT_TEXT_SHA256: 'a'.repeat(64),
      MONO_PROVE_PRIVACY_NOTICE_VERSION: 'privacy-v1',
      MONO_PROVE_LAWFUL_BASIS_VERSION: 'basis-v1',
      VERIFICATION_OPERATION_HMAC_ACTIVE_KEY_VERSION: 'verify-hmac-v1',
      VERIFICATION_OPERATION_HMAC_KEYS_JSON: JSON.stringify({ 'verify-hmac-v1': Buffer.alloc(32, 7).toString('base64') }),
      MONO_SEC_KEY: 'synthetic-sandbox-secret-not-a-credential',
      MONO_WEBHOOK_SECRET: 'synthetic-sandbox-webhook-not-a-credential',
      MONO_PROVE_REDIRECT_URL: 'https://app.starfetch.example/corporate/verify',
      CORS_ORIGINS: 'https://app.starfetch.example',
    };
    expect(() => validateEnv(base(sandboxMono))).not.toThrow();
    expect(() => validateEnv(base({ ...sandboxMono, MONO_PROVE_CONSENT_TEXT_APPROVED: 'false' })))
      .toThrow(/MONO_PROVE_CONSENT_TEXT_APPROVED/);
    expect(() => validateEnv(base({ ...sandboxMono, CORS_ORIGINS: 'https://other.example' })))
      .toThrow(/CORS_ORIGINS/);
    expect(() => validateEnv(base({ ...sandboxMono, MONO_PROVE_REDIRECT_URL: 'http://app.starfetch.example/callback', NODE_ENV: 'production', SMTP_HOST: 'smtp.internal', JOINT_INVITATIONS_URL: 'https://app.starfetch.example/login' })))
      .toThrow(/HTTPS/);
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
