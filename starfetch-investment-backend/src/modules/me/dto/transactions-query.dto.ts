import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * GET /me/transactions pagination (Phase 2D). `page` is 1-based;
 * `pageSize` is bounded. Defaults are applied for absent params —
 * the dashboard example `?page=1&pageSize=5` is fully honored.
 */
export class TransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
