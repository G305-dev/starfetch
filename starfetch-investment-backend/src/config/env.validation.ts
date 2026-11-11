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
  JOINT_INVITATION_TTL_HOURS?: string;
  JOINT_INVITATIONS_URL?: string;
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

  // Corporate O2 remains unavailable unless the explicit feature switch,
  // KMS envelope key, separate versioned HMAC keyring, and privacy approvals
  // are all configured. Defaults never enable the route.
  const corporateO2Enabled = booleanSetting(errors, 'CORPORATE_O2_ENABLED', raw.CORPORATE_O2_ENABLED, false);
  if (corporateO2Enabled) {
    const approvals = [
      ['CORPORATE_O2_LAWFUL_BASIS_APPROVED', raw.CORPORATE_O2_LAWFUL_BASIS_APPROVED],
      ['CORPORATE_O2_PRIVACY_NOTICE_APPROVED', raw.CORPORATE_O2_PRIVACY_NOTICE_APPROVED],
      ['CORPORATE_O2_RETENTION_APPROVED', raw.CORPORATE_O2_RETENTION_APPROVED],
    ] as const;
    for (const [name, value] of approvals) {
      if (booleanSetting(errors, name, value, false) !== true) errors.push(`${name} must be true before Corporate O2 can be enabled.`);
    }
    const awsRegion = stringOrUndefined(raw.AWS_REGION);
    const kmsKeyId = stringOrUndefined(raw.CORPORATE_O2_KMS_KEY_ID);
    const kmsKeyVersion = stringOrUndefined(raw.CORPORATE_O2_KMS_KEY_VERSION);
    if (!awsRegion || !/^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(awsRegion)) errors.push('AWS_REGION is required and must be a valid region when Corporate O2 is enabled.');
    if (!kmsKeyId || /\s/.test(kmsKeyId)) errors.push('CORPORATE_O2_KMS_KEY_ID is required when Corporate O2 is enabled.');
    if (!kmsKeyVersion || !/^[A-Za-z0-9._-]{1,64}$/.test(kmsKeyVersion)) errors.push('CORPORATE_O2_KMS_KEY_VERSION is required when Corporate O2 is enabled.');
    validateCorporateO2HmacKeyring(errors, raw.CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION, raw.CORPORATE_O2_HMAC_KEYS_JSON);
  }

  // Mono Prove is sandbox-only in this implementation. No provider request is
  // possible without explicit enablement, separate vendor credentials, approved
  // legal/privacy/consent gates, and an allowlisted redirect origin. Live mode
  // is rejected even if somebody sets the feature flag.
  const monoProveEnabled = booleanSetting(errors, 'MONO_PROVE_ENABLED', raw.MONO_PROVE_ENABLED, false);
  const explicitMonoEnvironment = stringOrUndefined(raw.MONO_PROVE_ENVIRONMENT);
  const monoEnvironment = explicitMonoEnvironment ?? 'sandbox';
  if (!['sandbox', 'live'].includes(monoEnvironment)) errors.push('MONO_PROVE_ENVIRONMENT must be sandbox or live.');
  if (monoProveEnabled) {
    if (explicitMonoEnvironment !== 'sandbox') errors.push('MONO_PROVE_ENVIRONMENT must be explicitly set to sandbox; live Mono Prove is not enabled by this change.');
    if (nodeEnv === 'production') errors.push('MONO_PROVE_ENABLED must remain false in production for this sandbox-only implementation.');
    for (const [name, value] of [
      ['MONO_PROVE_LAWFUL_BASIS_APPROVED', raw.MONO_PROVE_LAWFUL_BASIS_APPROVED],
      ['MONO_PROVE_PRIVACY_NOTICE_APPROVED', raw.MONO_PROVE_PRIVACY_NOTICE_APPROVED],
      ['MONO_PROVE_CONSENT_TEXT_APPROVED', raw.MONO_PROVE_CONSENT_TEXT_APPROVED],
    ] as const) {
      if (booleanSetting(errors, name, value, false) !== true) errors.push(`${name} must be true before Mono Prove can be enabled.`);
    }
    const consentVersion = stringOrUndefined(raw.MONO_PROVE_CONSENT_TEXT_VERSION);
    const privacyVersion = stringOrUndefined(raw.MONO_PROVE_PRIVACY_NOTICE_VERSION);
    const lawfulBasisVersion = stringOrUndefined(raw.MONO_PROVE_LAWFUL_BASIS_VERSION);
    const consentTextHash = stringOrUndefined(raw.MONO_PROVE_CONSENT_TEXT_SHA256);
    if (!consentVersion || !/^[A-Za-z0-9._-]{1,64}$/.test(consentVersion)) errors.push('MONO_PROVE_CONSENT_TEXT_VERSION is required when Mono Prove is enabled.');
    if (!consentTextHash || !/^[0-9a-f]{64}$/.test(consentTextHash)) errors.push('MONO_PROVE_CONSENT_TEXT_SHA256 must be the approved consent text SHA-256 when Mono Prove is enabled.');
    if (!privacyVersion || !/^[A-Za-z0-9._-]{1,64}$/.test(privacyVersion)) errors.push('MONO_PROVE_PRIVACY_NOTICE_VERSION is required when Mono Prove is enabled.');
    if (!lawfulBasisVersion || !/^[A-Za-z0-9._-]{1,64}$/.test(lawfulBasisVersion)) errors.push('MONO_PROVE_LAWFUL_BASIS_VERSION is required when Mono Prove is enabled.');
    const monoSecret = stringOrUndefined(raw.MONO_SEC_KEY);
    const webhookSecret = stringOrUndefined(raw.MONO_WEBHOOK_SECRET);
    if (!monoSecret) errors.push('MONO_SEC_KEY is required when Mono Prove is enabled.');
    if (!webhookSecret) errors.push('MONO_WEBHOOK_SECRET is required when Mono Prove is enabled.');
    if (monoSecret && webhookSecret && monoSecret === webhookSecret) errors.push('MONO_SEC_KEY and MONO_WEBHOOK_SECRET must be distinct secrets.');
    validateMonoRedirect(errors, raw.MONO_PROVE_REDIRECT_URL, raw.CORS_ORIGINS, productionLike);
  }

  // Mono Lookup is a separate product/adapter with its own sandbox key.
  // Both providers use Mono's documented shared API host; sandbox/live are
  // selected by credentials, so only explicit sandbox configuration is allowed.
  const monoLookupEnabled = booleanSetting(errors, 'MONO_LOOKUP_ENABLED', raw.MONO_LOOKUP_ENABLED, false);
  const explicitLookupEnvironment = stringOrUndefined(raw.MONO_LOOKUP_ENVIRONMENT);
  if (monoLookupEnabled) {
    if (explicitLookupEnvironment !== 'sandbox') errors.push('MONO_LOOKUP_ENVIRONMENT must be explicitly set to sandbox.');
    if (nodeEnv === 'production') errors.push('MONO_LOOKUP_ENABLED must remain false in production for this sandbox-only implementation.');
    for (const [name, value] of [
      ['MONO_LOOKUP_LAWFUL_BASIS_APPROVED', raw.MONO_LOOKUP_LAWFUL_BASIS_APPROVED],
      ['MONO_LOOKUP_PRIVACY_NOTICE_APPROVED', raw.MONO_LOOKUP_PRIVACY_NOTICE_APPROVED],
      ['MONO_LOOKUP_CONSENT_TEXT_APPROVED', raw.MONO_LOOKUP_CONSENT_TEXT_APPROVED],
    ] as const) {
      if (booleanSetting(errors, name, value, false) !== true) errors.push(`${name} must be true before Mono Lookup can be enabled.`);
    }
    for (const [name, value] of [
      ['MONO_LOOKUP_CONSENT_TEXT_VERSION', raw.MONO_LOOKUP_CONSENT_TEXT_VERSION],
      ['MONO_LOOKUP_PRIVACY_NOTICE_VERSION', raw.MONO_LOOKUP_PRIVACY_NOTICE_VERSION],
      ['MONO_LOOKUP_LAWFUL_BASIS_VERSION', raw.MONO_LOOKUP_LAWFUL_BASIS_VERSION],
    ] as const) {
      const version = stringOrUndefined(value);
      if (!version || !/^[A-Za-z0-9._-]{1,64}$/.test(version)) errors.push(`${name} is required when Mono Lookup is enabled.`);
    }
    const lookupConsentHash = stringOrUndefined(raw.MONO_LOOKUP_CONSENT_TEXT_SHA256);
    if (!lookupConsentHash || !/^[0-9a-f]{64}$/.test(lookupConsentHash)) errors.push('MONO_LOOKUP_CONSENT_TEXT_SHA256 must be the approved consent text SHA-256 when Mono Lookup is enabled.');
    const lookupKey = stringOrUndefined(raw.MONO_LOOKUP_SEC_KEY);
    if (!lookupKey || !/^test_sk_[A-Za-z0-9_-]+$/.test(lookupKey)) errors.push('MONO_LOOKUP_SEC_KEY must be a Mono sandbox test_sk key when Mono Lookup is enabled.');
    if (lookupKey && stringOrUndefined(raw.MONO_SEC_KEY) === lookupKey) errors.push('MONO_LOOKUP_SEC_KEY must be separate from the Mono Prove credential.');
    validateVerificationOperationKeyring(errors, raw.VERIFICATION_OPERATION_HMAC_ACTIVE_KEY_VERSION, raw.VERIFICATION_OPERATION_HMAC_KEYS_JSON);
  }
  if (monoProveEnabled) {
    validateVerificationOperationKeyring(errors, raw.VERIFICATION_OPERATION_HMAC_ACTIVE_KEY_VERSION, raw.VERIFICATION_OPERATION_HMAC_KEYS_JSON);
  }

  // SMTP must be configured for real delivery in staging/production.
  const smtpHost = stringOrUndefined(raw.SMTP_HOST);
  if (productionLike && !smtpHost) {
    errors.push('SMTP_HOST is required in staging/production (verification codes must be deliverable).');
  }

  // ── Phase 3B: joint invitation configuration ─────────────────────────────
  // TTL: positive, finite, bounded (max 30 days — "unreasonable" durations
  // rejected). Default 168h (7 days) is the preserving-dev default; zero/
  // negative/NaN/Infinity values must fail startup.
  const ttlRaw = raw.JOINT_INVITATION_TTL_HOURS as string | undefined;
  if (ttlRaw !== undefined && ttlRaw.trim().length > 0) {
    const ttl = Number(ttlRaw.trim());
    if (!Number.isFinite(ttl) || ttl <= 0 || ttl > 720) {
      errors.push(
        'JOINT_INVITATION_TTL_HOURS must be a finite number in (0, 720] hours (zero/negative/NaN/Infinity/unbounded durations rejected).',
      );
    }
  }
  // Invitation page URL: when set it must be a syntactically valid http(s)
  // URL with NO query/fragment (no place to smuggle tokens/credentials).
  // In staging/production it is REQUIRED, must be HTTPS, and must not point
  // at localhost/127.0.0.1/[::1] — production mail can never carry a local link.
  const urlRaw = stringOrUndefined(raw.JOINT_INVITATIONS_URL);
  if (urlRaw) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(urlRaw);
    } catch {
      parsed = null;
    }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || parsed.search || parsed.hash || parsed.username || parsed.password) {
      errors.push(
        'JOINT_INVITATIONS_URL must be a plain http/https URL without query, fragment or embedded credentials.',
      );
    } else if (productionLike) {
      const host = parsed.hostname.toLowerCase();
      if (parsed.protocol !== 'https:') {
        errors.push('JOINT_INVITATIONS_URL must use HTTPS in staging/production.');
      }
      if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) || host.endsWith('.local')) {
        errors.push('JOINT_INVITATIONS_URL must not point to localhost in staging/production.');
      }
    }
  } else if (productionLike) {
    errors.push('JOINT_INVITATIONS_URL is required in staging/production (invitation links must target the real app).');
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
    JOINT_INVITATION_TTL_HOURS: stringOrUndefined(raw.JOINT_INVITATION_TTL_HOURS),
    JOINT_INVITATIONS_URL: urlRaw,
  };
}

function validateMonoRedirect(
  errors: string[],
  rawRedirect: unknown,
  rawOrigins: unknown,
  productionLike: boolean,
): void {
  const redirect = stringOrUndefined(rawRedirect);
  if (!redirect) {
    errors.push('MONO_PROVE_REDIRECT_URL is required when Mono Prove is enabled.');
    return;
  }
  let parsed: URL;
  try { parsed = new URL(redirect); } catch { parsed = null as unknown as URL; }
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    errors.push('MONO_PROVE_REDIRECT_URL must be a plain http/https URL without credentials, query, or fragment.');
    return;
  }
  const origins = typeof rawOrigins === 'string'
    ? rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [];
  if (!origins.includes(parsed.origin)) errors.push('MONO_PROVE_REDIRECT_URL origin must be present in CORS_ORIGINS.');
  const host = parsed.hostname.toLowerCase();
  if (productionLike && (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) || host.endsWith('.local'))) {
    errors.push('MONO_PROVE_REDIRECT_URL must use a non-local HTTPS origin in staging/production.');
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function booleanSetting(errors: string[], name: string, value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  errors.push(`${name} must be exactly true or false.`);
  return false;
}

function validateCorporateO2HmacKeyring(errors: string[], activeValue: unknown, serializedValue: unknown): void {
  const activeVersion = stringOrUndefined(activeValue);
  if (!activeVersion || !/^[A-Za-z0-9._-]{1,32}$/.test(activeVersion)) {
    errors.push('CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION is required when Corporate O2 is enabled.');
  }
  if (typeof serializedValue !== 'string') {
    errors.push('CORPORATE_O2_HMAC_KEYS_JSON is required when Corporate O2 is enabled.');
    return;
  }
  try {
    const parsed: unknown = JSON.parse(serializedValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid keyring');
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0 || entries.some(([version, value]) => {
      if (!/^[A-Za-z0-9._-]{1,32}$/.test(version) || typeof value !== 'string') return true;
      const decoded = Buffer.from(value, 'base64');
      return decoded.length < 32 || decoded.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '');
    })) throw new Error('invalid keyring');
    if (!entries.some(([version]) => version === activeVersion)) throw new Error('active version missing');
  } catch {
    errors.push('CORPORATE_O2_HMAC_KEYS_JSON must be a version-to-base64-key object with keys of at least 32 bytes and contain the active version.');
  }
}

function validateVerificationOperationKeyring(errors: string[], activeValue: unknown, serializedValue: unknown): void {
  const activeVersion = stringOrUndefined(activeValue);
  if (!activeVersion || !/^[A-Za-z0-9._-]{1,32}$/.test(activeVersion)) {
    errors.push('VERIFICATION_OPERATION_HMAC_ACTIVE_KEY_VERSION is required when a Mono verification provider is enabled.');
  }
  if (typeof serializedValue !== 'string') {
    errors.push('VERIFICATION_OPERATION_HMAC_KEYS_JSON is required when a Mono verification provider is enabled.');
    return;
  }
  try {
    const parsed: unknown = JSON.parse(serializedValue);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length === 0 || entries.some(([version, value]) => {
      if (!/^[A-Za-z0-9._-]{1,32}$/.test(version) || typeof value !== 'string') return true;
      const decoded = Buffer.from(value, 'base64');
      return decoded.length < 32 || decoded.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '');
    })) throw new Error('invalid');
    if (!entries.some(([version]) => version === activeVersion)) throw new Error('active version missing');
  } catch {
    errors.push('VERIFICATION_OPERATION_HMAC_KEYS_JSON must be a version-to-base64-key object with keys of at least 32 bytes and contain the active version.');
  }
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
