export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
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
});
