import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import {
  DAILY_BUDGET_DIVISOR,
  MARKET_DATA_CLOCK,
  MARKET_DATA_FETCH,
  MARKET_DATA_PROVIDER_CLIENT,
  MARKET_DATA_REDIS_CLIENT,
  MARKET_DATA_SETTINGS,
  MARKET_DATA_STORE,
} from './market-data.constants';
import { MarketDataController } from './market-data.controller';
import { MarketDataService, systemClock } from './market-data.service';
import { MarketDataSettings, RawMarketDataConfig, resolveMarketDataSettings } from './market-data.settings';
import { MarketDataRedis, MarketDataStore } from './market-data.store';
import { FetchLike, NgnMarketClient } from './ngn-market.client';

/**
 * Isolated NGN Market data module. It has no dependency on auth, Prisma,
 * onboarding, KYC, investments or admin modules, and nothing depends on it.
 * Construction performs no network I/O: the Upstash client connects lazily on
 * the first command, and the provider is called only from a public request
 * whose cache is due — never at startup.
 */
@Module({
  controllers: [MarketDataController],
  providers: [
    {
      provide: MARKET_DATA_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MarketDataSettings =>
        resolveMarketDataSettings(config.get<RawMarketDataConfig>('marketData'), DAILY_BUDGET_DIVISOR),
    },
    {
      provide: MARKET_DATA_REDIS_CLIENT,
      inject: [MARKET_DATA_SETTINGS],
      useFactory: (settings: MarketDataSettings): MarketDataRedis | undefined => {
        if (settings.state !== 'enabled') return undefined;
        const redis = new Redis({
          url: settings.redisRestUrl,
          token: settings.redisRestToken,
          retry: false,
          enableTelemetry: false,
          automaticDeserialization: false,
          signal: () => AbortSignal.timeout(1_500),
        });
        return {
          get: (key) => redis.get(key),
          set: (key, value, opts) => redis.set(key, value, opts),
          eval: (script, keys, args) => redis.eval(script, keys, args),
        };
      },
    },
    { provide: MARKET_DATA_FETCH, useValue: ((input, init) => fetch(input, init)) satisfies FetchLike },
    { provide: MARKET_DATA_CLOCK, useValue: systemClock },
    {
      provide: MARKET_DATA_STORE,
      inject: [MARKET_DATA_REDIS_CLIENT],
      useFactory: (redis: MarketDataRedis | undefined) => (redis ? new MarketDataStore(redis) : undefined),
    },
    {
      provide: MARKET_DATA_PROVIDER_CLIENT,
      inject: [MARKET_DATA_SETTINGS, MARKET_DATA_FETCH],
      useFactory: (settings: MarketDataSettings, fetchImpl: FetchLike) =>
        settings.state === 'enabled' ? new NgnMarketClient(fetchImpl, settings.apiKey) : undefined,
    },
    MarketDataService,
  ],
})
export class MarketDataModule {}
