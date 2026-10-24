import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Database infrastructure foundation (Phase 2A).
 * Prisma is wired and ready; there are no business models yet, so no module
 * consumes this service in this phase.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
