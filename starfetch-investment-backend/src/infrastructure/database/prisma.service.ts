import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

/**
 * PostgreSQL access point for Starfetch modules (system of record for the
 * current MVP's structured data only — IMS persistence remains
 * "TBD — REQUIRES FUTURE IMS ARCHITECTURE").
 *
 * Phase 2B: the generated client now exists (authentication/identity models).
 * DATABASE_URL is validated fail-fast at startup. A connect failure at boot is
 * logged loudly but does not crash the process, so /health and startup
 * diagnostics remain available; auth endpoints then fail safely via the
 * centralized error filter.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('database.url');
    super({
      datasources: { db: { url } },
      log: ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL.');
    } catch (error) {
      this.logger.warn(
        `PostgreSQL not reachable at boot — auth endpoints will fail safely until connectivity is restored. (${
          error instanceof Error ? error.name : 'unknown error'
        })`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
