import { ArrowDownToLine, ArrowUpRight, CircleDollarSign, FileText, Landmark, type LucideIcon } from "lucide-react";

/**
 * Temporary local data for the Transactions frontend mockup.
 * Replace with David's approved transaction, summary, pagination, and receipt API responses later.
 */
export type TransactionType = "Investment Funded" | "Return Payment" | "Deposit" | "Withdrawal";
export type TransactionStatus = "Successful" | "Pending" | "Failed";

export type PortalTransaction = {
  id: string;
  reference: string;
  type: TransactionType;
  product: string;
  date: string;
  dateValue: string;
  amount: string;
  status: TransactionStatus;
  icon: LucideIcon;
};

export const transactionMetadata = {
  lastUpdated: "20 Oct 2026, 10:24 AM",
  pageSize: 10,
};

export const transactionSummary = [
  { label: "Total Inflows", value: "₦15,750,000", trend: "18.6%", context: "vs. previous period", icon: ArrowDownToLine, emphasis: true },
  { label: "Total Outflows", value: "₦3,250,000", trend: "6.4%", context: "vs. previous period", icon: ArrowUpRight, emphasis: false },
  { label: "Total Transactions", value: "18", trend: "12.5%", context: "vs. previous period", icon: FileText, emphasis: false },
] as const;

export const transactionTypeOptions = ["All Transactions", "Investment Funded", "Return Payment", "Deposit", "Withdrawal"] as const;
export const transactionStatusOptions = ["All Statuses", "Successful", "Pending", "Failed"] as const;
export const transactionDateRangeOptions = ["Last 30 Days", "Last 3 Months", "Last 6 Months", "Last 12 Months"] as const;

export const portalTransactions: PortalTransaction[] = [
  { id: "SFH-20261020-001", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Fixed Note", date: "20 Oct 2026, 10:24 AM", dateValue: "2026-10-20", amount: "₦2,000,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20261015-004", reference: "Return payment", type: "Return Payment", product: "Starfetch Fixed Note", date: "15 Oct 2026, 09:15 AM", dateValue: "2026-10-15", amount: "₦250,000", status: "Successful", icon: ArrowDownToLine },
  { id: "SFH-20261012-003", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Discretionary Portfolios", date: "12 Oct 2026, 02:30 PM", dateValue: "2026-10-12", amount: "₦3,000,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20261001-002", reference: "Withdrawal request", type: "Withdrawal", product: "Starfetch Execution Mandate", date: "01 Oct 2026, 09:00 AM", dateValue: "2026-10-01", amount: "₦150,000", status: "Failed", icon: ArrowUpRight },
  { id: "SFH-20260928-006", reference: "Account funding", type: "Deposit", product: "Account Funding", date: "28 Sep 2026, 11:20 AM", dateValue: "2026-09-28", amount: "₦1,500,000", status: "Successful", icon: ArrowDownToLine },
  { id: "SFH-20260925-005", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Fixed Note", date: "25 Sep 2026, 02:10 PM", dateValue: "2026-09-25", amount: "₦1,250,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20260921-002", reference: "Return payment", type: "Return Payment", product: "Starfetch Discretionary Portfolios", date: "21 Sep 2026, 10:40 AM", dateValue: "2026-09-21", amount: "₦180,000", status: "Successful", icon: ArrowDownToLine },
  { id: "SFH-20260917-008", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Execution Mandate", date: "17 Sep 2026, 03:25 PM", dateValue: "2026-09-17", amount: "₦900,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20260913-001", reference: "Deposit", type: "Deposit", product: "Account Funding", date: "13 Sep 2026, 08:45 AM", dateValue: "2026-09-13", amount: "₦500,000", status: "Successful", icon: ArrowDownToLine },
  { id: "SFH-20260909-007", reference: "Return payment", type: "Return Payment", product: "Starfetch Fixed Note", date: "09 Sep 2026, 12:15 PM", dateValue: "2026-09-09", amount: "₦220,000", status: "Successful", icon: ArrowDownToLine },
  { id: "SFH-20260905-003", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Discretionary Portfolios", date: "05 Sep 2026, 11:50 AM", dateValue: "2026-09-05", amount: "₦1,100,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20260830-004", reference: "Withdrawal request", type: "Withdrawal", product: "Starfetch Execution Mandate", date: "30 Aug 2026, 04:05 PM", dateValue: "2026-08-30", amount: "₦300,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20260822-006", reference: "Return payment", type: "Return Payment", product: "Starfetch Discretionary Portfolios", date: "22 Aug 2026, 09:30 AM", dateValue: "2026-08-22", amount: "₦170,000", status: "Successful", icon: ArrowDownToLine },
  { id: "SFH-20260815-002", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Fixed Note", date: "15 Aug 2026, 01:40 PM", dateValue: "2026-08-15", amount: "₦1,500,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20260729-005", reference: "Return payment", type: "Return Payment", product: "Starfetch Execution Mandate", date: "29 Jul 2026, 10:00 AM", dateValue: "2026-07-29", amount: "₦145,000", status: "Successful", icon: ArrowDownToLine },
  { id: "SFH-20260718-003", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Discretionary Portfolios", date: "18 Jul 2026, 02:55 PM", dateValue: "2026-07-18", amount: "₦950,000", status: "Pending", icon: ArrowUpRight },
  { id: "SFH-20260626-001", reference: "Investment funding", type: "Investment Funded", product: "Starfetch Fixed Note", date: "26 Jun 2026, 09:50 AM", dateValue: "2026-06-26", amount: "₦1,250,000", status: "Successful", icon: ArrowUpRight },
  { id: "SFH-20260531-009", reference: "Withdrawal request", type: "Withdrawal", product: "Starfetch Execution Mandate", date: "31 May 2026, 03:15 PM", dateValue: "2026-05-31", amount: "₦180,000", status: "Successful", icon: ArrowUpRight },
];

export const transactionInsights = [
  { label: "Investment Funded", count: 8, percent: 44.4, color: "#16842F" },
  { label: "Return Payment", count: 5, percent: 27.8, color: "#80AF14" },
  { label: "Deposit", count: 2, percent: 11.1, color: "#B7D7A4" },
  { label: "Withdrawal", count: 2, percent: 11.1, color: "#F0DFA0" },
  { label: "Failed", count: 1, percent: 5.6, color: "#D88A8A" },
];

export const recentActivity = portalTransactions.slice(0, 5);
export const transactionSummaryIcon = CircleDollarSign;
export const accountFundingIcon = Landmark;
