import {
  BarChart3,
  Building2,
  CircleDollarSign,
  Coins,
  FileText,
  Landmark,
  LineChart,
  Plus,
  Settings,
  type LucideIcon,
  UserRound,
  WalletCards,
} from "lucide-react";

/** Local-only corporate dashboard mock data. Replace with approved backend data later. */
export const corporateCompany = {
  name: "Meridian Holdings",
  initials: "MH",
  accountLabel: "Corporate investor account",
  greeting: "Good morning",
};

export const corporateAccountStatus = {
  label: "Account verification complete",
  state: "complete" as const,
};

export type CorporateSummaryMetric = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "positive";
};

export const corporateSummaryMetrics: CorporateSummaryMetric[] = [
  { label: "Total Invested", value: "₦25,000,000", icon: Coins },
  { label: "Current Portfolio Value", value: "₦25,684,250", icon: BarChart3 },
  { label: "Return to Date", value: "+2.74%", icon: LineChart, tone: "positive" },
  { label: "Available Cash", value: "₦0.00", icon: WalletCards },
];

export const corporatePortfolioSeries = [
  { label: "Jan 2024", value: 21600000 },
  { label: "Feb 2024", value: 22450000 },
  { label: "Mar 2024", value: 23250000 },
  { label: "Apr 2024", value: 24000000 },
  { label: "May 2024", value: 24700000 },
  { label: "Jun 2024", value: 25684250 },
] as const;

export type CorporateQuickAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  primary?: boolean;
};

export const corporateQuickActions: CorporateQuickAction[] = [
  { label: "Add Funds", href: "#funds", icon: Plus, primary: true },
  { label: "View Statement", href: "#documents", icon: FileText },
  { label: "Contact Relationship Manager", href: "#contact", icon: UserRound },
];

export type CorporateInvestment = {
  name: string;
  status: "Active" | "Pending funding";
  amount: string;
  maturityDate: string;
  icon: LucideIcon;
};

export const corporateInvestments: CorporateInvestment[] = [
  { name: "Starfetch Fixed Note", status: "Active", amount: "₦15,000,000", maturityDate: "18 Dec 2026", icon: FileText },
  { name: "Discretionary Portfolio", status: "Active", amount: "₦7,000,000", maturityDate: "Ongoing", icon: CircleDollarSign },
  { name: "Execution Mandate", status: "Pending funding", amount: "₦3,000,000", maturityDate: "—", icon: BarChart3 },
];

export type CorporateRecentActivityItem = {
  date: string;
  description: string;
  amount: string;
  status: "Completed";
};

export const corporateRecentActivity: CorporateRecentActivityItem[] = [
  { date: "12 Jun 2024", description: "Investment in Discretionary Portfolio", amount: "₦7,000,000", status: "Completed" },
  { date: "03 May 2024", description: "Investment in Starfetch Fixed Note", amount: "₦15,000,000", status: "Completed" },
];

export type CorporateDocument = {
  label: string;
  icon: LucideIcon;
};

export const corporateDocuments: CorporateDocument[] = [
  { label: "Latest Statement", icon: FileText },
  { label: "Company Verification", icon: Building2 },
];

export const corporateSidebarNavigation = [
  { label: "Overview", href: "/corporate/dashboard", icon: Landmark },
  { label: "Investments", href: "/corporate/investments", icon: BarChart3 },
  { label: "Transactions", href: "/corporate/transactions", icon: LineChart },
  { label: "Documents", href: "/corporate/documents", icon: FileText },
  { label: "Company Profile", href: "/corporate/profile", icon: Building2 },
  { label: "Settings", href: "/corporate/settings", icon: Settings },
] as const;
