import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { DashboardService, PortfolioView, TransactionView } from './dashboard.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';

/**
 * Phase 2D — investor dashboard read APIs (`/me/portfolio`, `/me/transactions`).
 *
 * - Authentication: session-aware AccessTokenGuard.
 * - Authorization: INVESTOR role only (RolesGuard).
 * - Ownership: strictly the authenticated principal's userId — userId is
 *   NEVER accepted from query/body/path. No investor can read another's data.
 * - Empty state: investors with no portfolio rows get a real, successful
 *   empty dashboard — never seeded/demo data.
 */
@Controller('me')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.INVESTOR)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('portfolio')
  async getPortfolio(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ data: PortfolioView; meta: { asOf: string } }> {
    const data = await this.dashboard.getPortfolio(req.principal!.userId);
    return { data, meta: { asOf: new Date().toISOString() } };
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: AuthenticatedRequest,
    @Query() query: TransactionsQueryDto,
  ): Promise<{
    data: TransactionView[];
    meta: { page: number; pageSize: number; total: number };
  }> {
    return this.dashboard.getTransactions(req.principal!.userId, query);
  }
}
