const ALLOWED_NODE_ENVS = ['development', 'test', 'staging', 'production'] as const;

export interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGINS: string;
  API_VERSION?: string;
  JWT_ACCESS_SECRET: string;
  CSRF_HMAC_SECRET: string;
  EMAIL_VERIFICATION_HMAC_SECRET: string;
}

const MIN_SECRET_LENGTH = 32;
const KNOWN_WEAK_PATTERNS = [/change-?me/i, /placeholder/i, /example/i, /^0+$/, /^1234/];

/**
 * Startup environment validation (fail-fast, fail-secure).
 *
 * Phase 2B: authentication is live, therefore DATABASE_URL and the three
 * authentication secrets are REQUIRED in every environment, and in
 * staging/production they must additionally be strong (length + not a known
 * placeholder). Development/test may use local dev values.
 */
export function validateEnv(raw: Record<string, unknown>): ValidatedEnv {
  const errors: string[] = [];

  const nodeEnv = (raw.NODE_ENV as string | undefined) ?? 'development';
  if (!ALLOWED_NODE_ENVS.includes(nodeEnv as (typeof ALLOWED_NODE_ENVS)[number])) {
    errors.push(`NODE_ENV must be one of: ${ALLOWED_NODE_ENVS.join(', ')}.`);
  }
  const productionLike = nodeEnv === 'staging' || nodeEnv === 'production';

  const port = Number(raw.PORT ?? '4000');
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535.');
  }

  // PostgreSQL system of record — required since Phase 2B.
  const databaseUrl = (raw.DATABASE_URL as string | undefined)?.trim() || undefined;
  if (databaseUrl === undefined) {
    errors.push('DATABASE_URL is required (PostgreSQL is the Phase 2B system of record).');
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push(
      'DATABASE_URL must be a PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/db).',
    );
  }

  // Authentication secrets — required; strong in staging/production.
  const jwtAccessSecret = stringOrUndefined(raw.JWT_ACCESS_SECRET);
  const csrfHmacSecret = stringOrUndefined(raw.CSRF_HMAC_SECRET);
  const emailVerificationHmacSecret = stringOrUndefined(raw.EMAIL_VERIFICATION_HMAC_SECRET);
  checkSecret(errors, 'JWT_ACCESS_SECRET', jwtAccessSecret, productionLike);
  checkSecret(errors, 'CSRF_HMAC_SECRET', csrfHmacSecret, productionLike);
  checkSecret(errors, 'EMAIL_VERIFICATION_HMAC_SECRET', emailVerificationHmacSecret, productionLike);

  // SMTP must be configured for real delivery in staging/production.
  const smtpHost = stringOrUndefined(raw.SMTP_HOST);
  if (productionLike && !smtpHost) {
    errors.push('SMTP_HOST is required in staging/production (verification codes must be deliverable).');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(' ')}`);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl!,
    CORS_ORIGINS: (raw.CORS_ORIGINS as string | undefined) ?? '',
    API_VERSION: raw.API_VERSION as string | undefined,
    JWT_ACCESS_SECRET: jwtAccessSecret!,
    CSRF_HMAC_SECRET: csrfHmacSecret!,
    EMAIL_VERIFICATION_HMAC_SECRET: emailVerificationHmacSecret!,
  };
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function checkSecret(
  errors: string[],
  name: string,
  value: string | undefined,
  productionLike: boolean,
): void {
  if (!value) {
    errors.push(`${name} is required (authentication cannot start securely without it).`);
    return;
  }
  if (productionLike) {
    if (value.length < MIN_SECRET_LENGTH) {
      errors.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters in staging/production.`);
    }
    if (KNOWN_WEAK_PATTERNS.some((pattern) => pattern.test(value))) {
      errors.push(`${name} must not be a known placeholder/example value in staging/production.`);
    }
  }
}
