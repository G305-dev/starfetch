import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  PORTFOLIO_CURRENCY,
  PortfolioView,
  TransactionView,
  toHoldingView,
  toTransactionView,
} from '../../me/dashboard.service';
import { TransactionsQueryDto } from '../../me/dto/transactions-query.dto';
import { JointAccountContext } from '../guards/joint-membership.guard';

/** R1 summary row (PROPOSED-JOINT-API-DRAFT v0.5.0-draft.3 · JointAccountSummary). */
export interface JointAccountSummaryView {
  jointAccountId: string;
  displayName: string;
  memberCount: number;
  holderNames: string[];
  myJoinedAt: string;
  isFull: boolean;
  awaitingSecondHolder: boolean;
}

/** R2 member row (draft JointMember) — approved basic holder info ONLY. */
export interface JointMemberView {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  joinedAt: string;
}

export interface JointAccountDetailView {
  jointAccountId: string;
  displayName: string;
  createdAt: string;
  members: JointMemberView[];
  membership: { capacity: 2; activeCount: number; awaitingSecondHolder: boolean };
}

const HOLDER_SELECT = {
  userId: true,
  joinedAt: true,
  user: {
    select: {
      email: true,
      investorProfile: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

/**
 * Phase 3B Step 3 — READ-ONLY Joint Investor queries.
 *
 * Ownership/model rules (strict):
 *  - Authorization was already proven by JointMembershipGuard (POSTGRES, every
 *    request) — services act ONLY on the verified {@link JointAccountContext};
 *    request bodies/queries are never consulted for identity or ownership.
 *  - R1 resolves purely through the caller's membership rows; account creation
 *    or invitation state grants NOTHING.
 *  - Joint financial data is retrieved via `Portfolio.jointAccountId` ONLY —
 *    never via `Portfolio.userId` (individual reads remain separate code paths
 *    in DashboardService and are untouched).
 *  - Row serialization is shared with Phase 2D (`toHoldingView` /
 *    `toTransactionView`) so joint responses are byte-identical in shape to
 *    the approved individual contract. `totalValueMinor` sums STORED values;
 *    NO valuation/return logic exists. `totalReturnMinor` is always null.
 */
@Injectable()
export class JointReadService {
  constructor(private readonly prisma: PrismaService) {}

  /** R1 — accounts where the caller holds an ACTIVE membership row. */
  async listMyJointAccounts(userId: string): Promise<JointAccountSummaryView[]> {
    const memberships = await this.prisma.jointAccountMember.findMany({
      where: { userId },
      orderBy: { joinedAt: 'asc' }, // stable, deterministic
      select: {
        joinedAt: true,
        jointAccount: {
          select: {
            id: true,
            displayName: true,
            members: { select: HOLDER_SELECT, orderBy: { joinedAt: 'asc' } },
          },
        },
      },
    });

    return memberships.map((m) => {
      const a = m.jointAccount;
      const memberCount = a.members.length;
      return {
        jointAccountId: a.id,
        displayName: a.displayName,
        memberCount,
        holderNames: a.members.map((mm) => holderName(mm)),
        myJoinedAt: m.joinedAt.toISOString(),
        isFull: memberCount >= 2,
        awaitingSecondHolder: memberCount === 1,
      };
    });
  }

  /** R2 — account detail + ACTIVE members, using the VERIFIED context. */
  async getJointAccount(ctx: JointAccountContext): Promise<JointAccountDetailView> {
    // ctx.jointAccountId is guard-verified; the account therefore exists.
    const account = await this.prisma.jointAccount.findUniqueOrThrow({
      where: { id: ctx.jointAccountId },
      select: {
        id: true,
        displayName: true,
        createdAt: true,
        members: { select: HOLDER_SELECT, orderBy: { joinedAt: 'asc' } },
      },
    });
    const activeCount = account.members.length;
    return {
      jointAccountId: account.id,
      displayName: account.displayName,
      createdAt: account.createdAt.toISOString(),
      members: account.members.map((m) => ({
        userId: m.userId,
        firstName: m.user.investorProfile?.firstName ?? '',
        lastName: m.user.investorProfile?.lastName ?? '',
        email: m.user.email,
        joinedAt: m.joinedAt.toISOString(),
      })),
      membership: {
        capacity: 2 as const,
        activeCount,
        awaitingSecondHolder: activeCount === 1,
      },
    };
  }

  /** R3 — joint portfolio, queried via Portfolio.jointAccountId ONLY. */
  async getJointPortfolio(ctx: JointAccountContext): Promise<PortfolioView> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { jointAccountId: ctx.jointAccountId },
      include: { holdings: { orderBy: { asOf: 'desc' } } },
    });

    // A joint account may legitimately have no portfolio row yet (awaiting
    // funding) — the honest empty state, identical contract to /me/portfolio.
    if (!portfolio || portfolio.holdings.length === 0) {
      return {
        currency: PORTFOLIO_CURRENCY,
        totalValueMinor: 0,
        holdingCount: 0,
        totalReturnMinor: null,
        holdings: [],
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

  /** R4 — joint transaction page, strictly through the joint-owned portfolio. */
  async getJointTransactions(
    ctx: JointAccountContext,
    query: TransactionsQueryDto,
  ): Promise<{ data: TransactionView[]; meta: { page: number; pageSize: number; total: number } }> {
    const { page, pageSize } = query;
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { jointAccountId: ctx.jointAccountId },
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
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], // identical to Phase 2D (stable ties)
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { data: rows.map(toTransactionView), meta: { page, pageSize, total } };
  }
}

function holderName(m: {
  user: { investorProfile: { firstName: string; lastName: string } | null };
}): string {
  const p = m.user.investorProfile;
  return p ? `${p.firstName} ${p.lastName}`.trim() : '';
}
