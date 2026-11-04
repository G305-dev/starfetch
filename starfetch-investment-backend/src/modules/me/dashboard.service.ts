import { Injectable } from '@nestjs/common';
import { Holding, Transaction } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TransactionsQueryDto } from './dto/transactions-query.dto';

/** Contract shape (Phase 2D) — stored values only, never market logic. */
export interface HoldingView {
  id: string;
  instrumentLabel: string;
  quantity: string | null;
  valueMinor: number;
  currency: string;
  asOf: string;
  isDemo: false; // no demo/fake data exists in the system
}

export interface PortfolioView {
  currency: string;
  totalValueMinor: number;
  holdingCount: number;
  /** Stays null until an APPROVED return/cost-basis calculation exists. */
  totalReturnMinor: null;
  holdings: HoldingView[];
}

export interface TransactionView {
  id: string;
  type: string;
  status: string;
  amountMinor: number;
  currency: string;
  description: string | null;
  occurredAt: string;
}

export const PORTFOLIO_CURRENCY = 'NGN';

// Reused by Joint reads (Phase 3B Step 3) so row serialization stays byte-identical.
export function toHoldingView(h: Holding): HoldingView {
  return {
    id: h.id,
    instrumentLabel: h.instrumentLabel,
    quantity: h.quantity === null ? null : h.quantity.toString(), // Decimal → string
    valueMinor: Number(h.valueMinor),
    currency: h.currency,
    asOf: h.asOf.toISOString(),
    isDemo: false,
  };
}

export function toTransactionView(t: Transaction): TransactionView {
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    amountMinor: Number(t.amountMinor),
    currency: t.currency,
    description: t.description,
    occurredAt: t.occurredAt.toISOString(),
  };
}

/**
 * Investor dashboard reads (Phase 2D). Ownership comes EXCLUSIVELY from the
 * authenticated principal. A missing Portfolio row is a NORMAL state for new
 * investors — we return a real empty dashboard, never seeded/fake records.
 * totalValueMinor aggregates STORED holding values only; no market valuation,
 * rates, yields, fees, performance or returns logic exists here.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortfolio(userId: string): Promise<PortfolioView> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      include: { holdings: { orderBy: { asOf: 'desc' } } },
    });

    if (!portfolio || portfolio.holdings.length === 0) {
      return {
        currency: PORTFOLIO_CURRENCY,
        totalValueMinor: 0,
        holdingCount: 0,
        totalReturnMinor: null,
        holdings: (portfolio?.holdings ?? []).map(toHoldingView),
      };
    }

    const holdings = portfolio.holdings.map(toHoldingView);
    const total = portfolio.holdings.reduce((sum, h) => sum + h.valueMinor, BigInt(0));
    return {
      currency: PORTFOLIO_CURRENCY,
      totalValueMinor: Number(total),
      holdingCount: holdings.length,
      totalReturnMinor: null,
      holdings,
    };
  }

  async getTransactions(
    userId: string,
    query: TransactionsQueryDto,
  ): Promise<{ data: TransactionView[]; meta: { page: number; pageSize: number; total: number } }> {
    const { page, pageSize } = query;
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!portfolio) {
      return { data: [], meta: { page, pageSize, total: 0 } };
    }

    const where = { portfolioId: portfolio.id };
    const [total, rows] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data: rows.map(toTransactionView), meta: { page, pageSize, total } };
  }
}
