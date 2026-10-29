import {
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  FileDown,
  FolderUp,
  LayoutDashboard,
  Landmark,
  Megaphone,
  ShieldCheck,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

/**
 * Temporary local data for the new Individual Investor dashboard frontend state.
 * Replace with David's approved account, verification, portfolio, notification, and product API responses later.
 */
export const individualDashboardUser = {
  firstName: "Emmanuel",
  fullName: "Emmanuel A.",
  accountType: "Individual Investor",
  initials: "EA",
};

export const accountVerification = {
  progress: 10,
  status: "In Progress",
  title: "Complete your account verification",
  description: "Finish your KYC to start investing and unlock all features.",
  href: "/profile",
};

export const individualDashboardMetrics = [
  { label: "Total Portfolio Value", value: "₦0.00", detail: "0% from last month", icon: WalletCards, emphasis: true },
  { label: "Total Investments", value: "0", detail: "Active investments", icon: Sparkles, emphasis: false },
  { label: "Total Returns", value: "₦0.00", detail: "0% from last month", icon: BarChart3, emphasis: false },
  { label: "Available Balance", value: "₦0.00", detail: "Add funds to start investing", icon: Landmark, emphasis: false },
] as const;

export const portfolioOverview = {
  range: "Last 6 months",
  totalValue: "₦0.00",
  emptyMessage: "No portfolio activity yet",
  emptyDescription: "Your portfolio overview will appear here once you make your first investment.",
};

export const assetAllocation = [
  { label: "Fixed Note", percent: 0, color: "#003B2A" },
  { label: "Discretionary Portfolios", percent: 0, color: "#2E7253" },
  { label: "Execution Mandate", percent: 0, color: "#80AF14" },
  { label: "Cash", percent: 0, color: "#B7D7A4" },
];

export type IndividualQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
};

export const individualQuickActions: IndividualQuickAction[] = [
  { label: "Create an Investment", href: "/products", icon: BriefcaseBusiness, primary: true },
  { label: "Fund Your Account", href: "/open-account", icon: WalletCards },
  { label: "Download Statements", href: "/dashboard#statements", icon: FileDown },
  { label: "Upload Documents", href: "/dashboard#documents", icon: FolderUp },
];

export type DashboardUpdate = {
  title: string;
  description: string;
  date: string;
  icon: LucideIcon;
  unread?: boolean;
};

export const latestUpdates: DashboardUpdate[] = [
  { title: "Welcome to Starfetch", description: "Start your investment journey today.", date: "20 Oct 2026", icon: Megaphone },
  { title: "Complete your KYC", description: "Verify your identity to unlock all features.", date: "20 Oct 2026", icon: ShieldCheck, unread: true },
  { title: "New Investment Opportunities", description: "Explore our latest investment solutions.", date: "18 Oct 2026", icon: BarChart3 },
];

export const individualInvestmentSolutions = [
  {
    title: "Starfetch Fixed Note",
    description: "Naira money-market instruments, treasury bills and quality corporate paper; designed for capital preservation and steady income.",
    icon: CircleDollarSign,
    tone: "gold",
  },
  {
    title: "Starfetch Discretionary Portfolios",
    description: "Day-to-day decisions delegated to our team under an agreed mandate, risk profile and investment policy statement.",
    icon: BarChart3,
    tone: "green",
  },
  {
    title: "Starfetch Execution Mandate",
    description: "You make every investment decision; we provide research, execution and administration.",
    icon: LayoutDashboard,
    tone: "sage" as const,
  },
] as const;

export const individualDashboardState = "ready" as const;
export const newInvestorNotificationIcon = BellRing;
