const ALLOWED_NODE_ENVS = ['development', 'test', 'staging', 'production'] as const;

export interface ValidatedEnv {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL?: string;
  CORS_ORIGINS: string;
  API_VERSION?: string;
}

/**
 * Hand-rolled environment validation (no extra dependency).
 * Fails clearly on genuinely invalid values, but keeps later-phase services
 * (e.g., DATABASE_URL) optional during the Phase 2A scaffold so the
 * foundation boots and health checks pass without a provisioned database.
 */
export function validateEnv(raw: Record<string, unknown>): ValidatedEnv {
  const errors: string[] = [];

  const nodeEnv = (raw.NODE_ENV as string | undefined) ?? 'development';
  if (!ALLOWED_NODE_ENVS.includes(nodeEnv as (typeof ALLOWED_NODE_ENVS)[number])) {
    errors.push(`NODE_ENV must be one of: ${ALLOWED_NODE_ENVS.join(', ')}.`);
  }

  const port = Number(raw.PORT ?? '4000');
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push('PORT must be an integer between 1 and 65535.');
  }

  const databaseUrl = (raw.DATABASE_URL as string | undefined)?.trim() || undefined;
  if (databaseUrl !== undefined && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push(
      'DATABASE_URL, when set, must be a PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/db).',
    );
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(' ')}`);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    CORS_ORIGINS: (raw.CORS_ORIGINS as string | undefined) ?? '',
    API_VERSION: raw.API_VERSION as string | undefined,
  };
}
