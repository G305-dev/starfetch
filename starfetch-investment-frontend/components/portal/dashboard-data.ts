import {
  ArrowDownToLine,
  ArrowUpRight,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  UserRound,
  FileText,
  HandCoins,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
  Settings,
  TrendingUp,
  Upload,
  WalletCards,
} from "lucide-react";

/**
 * Temporary staging data for the investor-dashboard frontend mockup.
 * Replace these structures with David's approved API responses later.
 */
export const dashboardUser = {
  firstName: "Emmanuel",
  fullName: "Emmanuel A.",
  initials: "EA",
  accountType: "Individual Investor",
  lastUpdated: "20 Oct 2026, 10:24 AM",
};

export type PortalNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
};

export const portalNavigation: PortalNavigationItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Investments", href: "/investments", icon: LineChart },
  { label: "Transactions", href: "/transactions", icon: ArrowUpRight },
  { label: "Notifications", href: "/dashboard#notifications", icon: Bell },
  { label: "Profile", href: "/profile", icon: UserRound },
  { label: "Settings", href: "/dashboard#settings", icon: Settings },
];

export type SummaryMetric = {
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
  icon: LucideIcon;
  emphasis?: boolean;
};

export const summaryMetrics: SummaryMetric[] = [
  {
    label: "Total Portfolio Value",
    value: "₦12,500,000",
    detail: "8.4% since last month",
    positive: true,
    icon: WalletCards,
    emphasis: true,
  },
  {
    label: "Total Invested",
    value: "₦10,000,000",
    detail: "Across your products",
    icon: BarChart3,
  },
  {
    label: "Total Returns (YTD)",
    value: "₦2,500,000",
    detail: "12.5%",
    positive: true,
    icon: CircleDollarSign,
  },
  {
    label: "Active Investments",
    value: "3",
    detail: "Across different products",
    icon: Clock3,
  },
];

export const portfolioChartData = [
  { month: "Apr 2026", value: 2.5 },
  { month: "May 2026", value: 4.7 },
  { month: "Jun 2026", value: 6.1 },
  { month: "Jul 2026", value: 8.8 },
  { month: "Aug 2026", value: 10.4 },
  { month: "Sep 2026", value: 10.2 },
  { month: "Oct 2026", value: 12.5 },
];

export type QuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const quickActions: QuickAction[] = [
  { label: "Make an Investment", href: "/open-account", icon: HandCoins },
  { label: "View Statements", href: "/dashboard#statements", icon: FileText },
  { label: "Upload Document", href: "/dashboard#documents", icon: Upload },
  { label: "Update Profile", href: "/dashboard#profile", icon: Settings },
];

export type Investment = {
  product: string;
  amountInvested: string;
  currentValue: string;
  returnValue: string;
  status: "Active";
  icon: LucideIcon;
};

export const investments: Investment[] = [
  {
    product: "Starfetch Fixed Note",
    amountInvested: "₦5,000,000",
    currentValue: "₦5,600,000",
    returnValue: "12.0%",
    status: "Active",
    icon: BriefcaseBusiness,
  },
  {
    product: "Starfetch Discretionary Portfolios",
    amountInvested: "₦3,000,000",
    currentValue: "₦3,300,000",
    returnValue: "10.0%",
    status: "Active",
    icon: TrendingUp,
  },
  {
    product: "Starfetch Execution Mandate",
    amountInvested: "₦2,000,000",
    currentValue: "₦2,200,000",
    returnValue: "10.0%",
    status: "Active",
    icon: HandCoins,
  },
];

export type Transaction = {
  title: string;
  timestamp: string;
  amount: string;
  type: "funded" | "return";
};

export const recentTransactions: Transaction[] = [
  { title: "Investment Funded", timestamp: "15 Oct 2026, 10:24 AM", amount: "₦2,000,000", type: "funded" },
  { title: "Return Payment", timestamp: "01 Oct 2026, 09:15 AM", amount: "₦250,000", type: "return" },
  { title: "Investment Funded", timestamp: "12 Sep 2026, 02:30 PM", amount: "₦3,000,000", type: "funded" },
  { title: "Return Payment", timestamp: "01 Sep 2026, 09:00 AM", amount: "₦180,000", type: "return" },
];

export const dashboardNotificationIcon = Bell;
export const transactionIcons = { funded: ArrowUpRight, return: ArrowDownToLine };
