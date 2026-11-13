import {
  BarChart3,
  Building2,
  FileText,
  Landmark,
  PackageOpen,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/** Corporate navigation is safe to render before Corporate read APIs are public. */
export type CorporateSidebarNavigationItem = { label: string; href: string; icon: LucideIcon };

export const corporateSidebarNavigation: CorporateSidebarNavigationItem[] = [
  { label: "Overview", href: "/corporate/dashboard", icon: Landmark },
  { label: "Investments", href: "/corporate/investments", icon: BarChart3 },
  { label: "Transactions", href: "/corporate/transactions", icon: FileText },
  { label: "Products", href: "/corporate/products", icon: PackageOpen },
  { label: "Company Profile", href: "/corporate/profile", icon: Building2 },
];

/**
 * Legacy presentational components still import these typed collections. They
 * are deliberately empty: no Corporate portfolio, company identity, activity
 * or document data is exposed until an approved public API is available.
 */
export type CorporateSummaryMetric = { label: string; value: string; icon: LucideIcon; tone?: "positive" };
export const corporateSummaryMetrics: CorporateSummaryMetric[] = [];

export type CorporatePortfolioSeriesPoint = { label: string; value: number };
export const corporatePortfolioSeries: CorporatePortfolioSeriesPoint[] = [];

export type CorporateQuickAction = { label: string; href: string; icon: LucideIcon; primary?: boolean };
export const corporateQuickActions: CorporateQuickAction[] = [];

/** Safe links only; no investment, funding, upload or approval operation is exposed. */
export const corporateDashboardQuickActions: CorporateQuickAction[] = [
  { label: "Verification progress", href: "/corporate/dashboard#verification", icon: ShieldCheck, primary: true },
  { label: "Company profile", href: "/corporate/profile", icon: Building2 },
  { label: "Document requirements", href: "/corporate/documents", icon: FileText },
];

export type CorporateInvestment = { name: string; status: "Active" | "Pending funding"; amount: string; maturityDate: string; icon: LucideIcon };
export const corporateInvestments: CorporateInvestment[] = [];

export type CorporateRecentActivityItem = { date: string; description: string; amount: string; status: "Completed" };
export const corporateRecentActivity: CorporateRecentActivityItem[] = [];

export type CorporateDocument = { label: string; icon: LucideIcon };
export const corporateDocuments: CorporateDocument[] = [];
