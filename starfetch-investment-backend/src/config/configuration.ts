export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const productionLike = nodeEnv === 'production' || nodeEnv === 'staging';

  return {
    nodeEnv,
    productionLike,
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
