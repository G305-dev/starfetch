import { Controller, Get, HttpException, Res, UseFilters } from '@nestjs/common';
import { Response } from 'express';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { MarketDataExceptionFilter } from './market-data-exception.filter';
import { MarketDataService, publicCacheMaxAgeSeconds } from './market-data.service';
import { PublicMarketSnapshot } from './market-data.types';

/**
 * Public, read-only, unauthenticated market snapshot for the website slider
 * and "Market at a Glance". No user data is read or written. Responses never
 * include provider credentials, raw provider payloads or quota metadata.
 */
@Controller('public/market-snapshot')
@UseFilters(MarketDataExceptionFilter)
export class MarketDataController {
  constructor(private readonly marketData: MarketDataService) {}

  @Get()
  @RateLimit({ bucket: 'public-market-snapshot', limit: 120, windowSeconds: 60 })
  async getSnapshot(@Res({ passthrough: true }) res: Response): Promise<PublicMarketSnapshot> {
    // Errors (disabled/unavailable) must never be cached by browsers or the CDN.
    res.setHeader('Cache-Control', 'no-store');
    try {
      const snapshot = await this.marketData.getPublicSnapshot();
      // ≤ 60 s, and never past the moment a served quote reaches the 7-day limit.
      const maxAge = publicCacheMaxAgeSeconds(snapshot);
      if (maxAge > 0) res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
      return snapshot;
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse() as { context?: { retryAfterSeconds?: unknown } };
        const retryAfter = body?.context?.retryAfterSeconds;
        if (typeof retryAfter === 'number') res.setHeader('Retry-After', String(retryAfter));
      }
      throw error;
    }
  }
}
