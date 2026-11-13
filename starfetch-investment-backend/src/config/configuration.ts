export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const productionLike = nodeEnv === 'production' || nodeEnv === 'staging';

  return {
    nodeEnv,
    productionLike,
    platform: {
      isVercel: process.env.VERCEL === '1',
      vercelEnvironment: process.env.VERCEL_ENV,
    },
    port: parseInt(process.env.PORT ?? '4000', 10),
    api: {
      prefix: process.env.API_PREFIX ?? 'api/v1',
      version: process.env.API_VERSION ?? '0.0.1',
    },
    cors: {
      origins: (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
    database: {
      url:
        process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0
          ? process.env.DATABASE_URL.trim()
          : undefined,
    },
    auth: {
      jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
      accessTokenTtlSeconds: parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS ?? '900', 10),
      refreshTokenTtlSeconds: parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS ?? '604800', 10),
      refreshIdleTtlSeconds: parseInt(process.env.REFRESH_IDLE_TTL_SECONDS ?? '86400', 10),
      csrfHmacSecret: process.env.CSRF_HMAC_SECRET,
      emailVerificationHmacSecret: process.env.EMAIL_VERIFICATION_HMAC_SECRET,
      // Email verification contract (10 min lifetime, 5 attempts, 60s cooldown,
      // max 5 resends/hour) — constants of the approved Phase 2B contract.
      verificationCodeTtlSeconds: 600,
      verificationMaxAttempts: 5,
      verificationResendCooldownSeconds: 60,
      verificationMaxResendsPerHour: 5,
      verificationResendWindowSeconds: 3600,
      // Cookie naming/attributes (transport concern, client-neutral services).
      cookies: {
        refreshName: productionLike ? '__Host-sf_refresh' : 'sf_refresh',
        csrfName: productionLike ? '__Host-sf_csrf' : 'sf_csrf',
        secure: productionLike,
      },
      // Server-side throttling for authentication-sensitive routes.
      // Enabled by default; disabled in automated tests to prevent flakiness
      // (the dedicated rate-limit e2e spec re-enables it with tiny limits).
      rateLimit: {
        enabled: (process.env.RATE_LIMIT_ENABLED ?? (nodeEnv === 'test' ? 'false' : 'true')) === 'true',
      },
    },
    // Phase 3B joint invitations (DEV defaults — pending business approval;
    // hard failure for invalid/critical values happens in env.validation).
    // Purpose-isolated fingerprint key for the internal non-TIN draft
    // bootstrap only. Never reuse auth HMAC secrets. Public O2/TIN fingerprint
    // handling has a separate unresolved approval gate and is not configured.
    corporate: {
      nonTinDraftFingerprintHmacSecret: process.env.CORPORATE_DRAFT_BOOTSTRAP_FINGERPRINT_HMAC_SECRET,
      o2: {
        enabled: process.env.CORPORATE_O2_ENABLED === 'true',
        lawfulBasisApproved: process.env.CORPORATE_O2_LAWFUL_BASIS_APPROVED === 'true',
        privacyNoticeApproved: process.env.CORPORATE_O2_PRIVACY_NOTICE_APPROVED === 'true',
        retentionApproved: process.env.CORPORATE_O2_RETENTION_APPROVED === 'true',
        kmsKeyId: process.env.CORPORATE_O2_KMS_KEY_ID,
        kmsKeyVersion: process.env.CORPORATE_O2_KMS_KEY_VERSION,
        awsRoleArn: process.env.AWS_ROLE_ARN,
        awsRegion: process.env.AWS_REGION,
        hmacActiveVersion: process.env.CORPORATE_O2_HMAC_ACTIVE_KEY_VERSION,
        hmacKeysJson: process.env.CORPORATE_O2_HMAC_KEYS_JSON,
        rateLimitRedisRestUrl: process.env.CORPORATE_O2_RATE_LIMIT_REDIS_REST_URL,
        rateLimitRedisRestToken: process.env.CORPORATE_O2_RATE_LIMIT_REDIS_REST_TOKEN,
        rateLimitHmacSecret: process.env.CORPORATE_O2_RATE_LIMIT_HMAC_SECRET,
      },
      mono: {
        enabled: process.env.MONO_PROVE_ENABLED === 'true',
        environment: process.env.MONO_PROVE_ENVIRONMENT ?? 'sandbox',
        secretKey: process.env.MONO_SEC_KEY,
        webhookSecret: process.env.MONO_WEBHOOK_SECRET,
        redirectUrl: process.env.MONO_PROVE_REDIRECT_URL,
        consentTextVersion: process.env.MONO_PROVE_CONSENT_TEXT_VERSION,
        consentTextSha256: process.env.MONO_PROVE_CONSENT_TEXT_SHA256,
        privacyNoticeVersion: process.env.MONO_PROVE_PRIVACY_NOTICE_VERSION,
        lawfulBasisVersion: process.env.MONO_PROVE_LAWFUL_BASIS_VERSION,
        lawfulBasisApproved: process.env.MONO_PROVE_LAWFUL_BASIS_APPROVED === 'true',
        privacyNoticeApproved: process.env.MONO_PROVE_PRIVACY_NOTICE_APPROVED === 'true',
        consentTextApproved: process.env.MONO_PROVE_CONSENT_TEXT_APPROVED === 'true',
      },
      monoLookup: {
        enabled: process.env.MONO_LOOKUP_ENABLED === 'true',
        environment: process.env.MONO_LOOKUP_ENVIRONMENT,
        secretKey: process.env.MONO_LOOKUP_SEC_KEY,
        consentTextApproved: process.env.MONO_LOOKUP_CONSENT_TEXT_APPROVED === 'true',
        consentTextVersion: process.env.MONO_LOOKUP_CONSENT_TEXT_VERSION,
        consentTextSha256: process.env.MONO_LOOKUP_CONSENT_TEXT_SHA256,
        privacyNoticeVersion: process.env.MONO_LOOKUP_PRIVACY_NOTICE_VERSION,
        lawfulBasisVersion: process.env.MONO_LOOKUP_LAWFUL_BASIS_VERSION,
        lawfulBasisApproved: process.env.MONO_LOOKUP_LAWFUL_BASIS_APPROVED === 'true',
        privacyNoticeApproved: process.env.MONO_LOOKUP_PRIVACY_NOTICE_APPROVED === 'true',
      },
    },
    verification: {
      operationHmacActiveVersion: process.env.VERIFICATION_OPERATION_HMAC_ACTIVE_KEY_VERSION,
      operationHmacKeysJson: process.env.VERIFICATION_OPERATION_HMAC_KEYS_JSON,
      documentCollectionEnabled: process.env.VERIFICATION_DOCUMENT_COLLECTION_ENABLED === 'true',
      staffReviewEnabled: process.env.CORPORATE_STAFF_REVIEW_ENABLED === 'true',
    },
    joint: {
      invitationTtlHours: (() => {
        const n = parseFloat(process.env.JOINT_INVITATION_TTL_HOURS ?? '168'); // 7 days
        return Number.isFinite(n) && n > 0 && n <= 720 ? n : 168;
      })(),
      invitationsUrl: process.env.JOINT_INVITATIONS_URL ?? 'http://localhost:3000/login',
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
      secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
      from: process.env.SMTP_FROM ?? 'Starfetch <no-reply@starfetch.local>',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };
};
