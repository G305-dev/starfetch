import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PrismaClientLike = {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
};

/**
 * Prisma/PostgreSQL access point for all later Starfetch business modules.
 *
 * Phase 2A behaviour (deliberate):
 *  - The Prisma schema intentionally contains ZERO business models (open
 *    decisions D-08 / D-09 and document/business vocabulary are unresolved),
 *    so `prisma generate` reports "no models defined" and no client exists yet.
 *  - The generated client is therefore loaded LAZILY: once the first approved
 *    model lands and `prisma generate` runs, this service picks it up without
 *    structural changes.
 *  - Without DATABASE_URL the service stays inactive by design; with one, a
 *    connection failure never crashes the foundation scaffold (strict DB
 *    readiness is enforced when business modules arrive).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly databaseUrl?: string;
  private client?: PrismaClientLike;

  constructor(config: ConfigService) {
    this.databaseUrl = config.get<string>('database.url');
  }

  async onModuleInit(): Promise<void> {
    if (!this.databaseUrl) {
      this.logger.log(
        'DATABASE_URL not set — Prisma/PostgreSQL inactive during Phase 2A scaffold (no business tables exist yet).',
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaClient } = require('@prisma/client');
      this.client = new PrismaClient({
        datasources: { db: { url: this.databaseUrl } },
      }) as PrismaClientLike;
      await this.client.$connect();
      this.logger.log('Connected to PostgreSQL.');
    } catch {
      this.logger.warn(
        'Prisma client not generated yet, or PostgreSQL unreachable — continuing without database connectivity (Phase 2A scaffold behaviour).',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
    }
  }
}
