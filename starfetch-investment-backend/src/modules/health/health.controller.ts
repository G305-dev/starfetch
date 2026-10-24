import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface HealthResponse {
  status: 'ok';
  version: string;
}

/**
 * GET /api/v1/health — public availability/integrity check.
 * Deliberately minimal and safe: no environment values, credentials,
 * database details, or server internals are exposed.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      version: this.config.get<string>('api.version') ?? '0.0.1',
    };
  }
}
