import { BarChart3, BriefcaseBusiness, CheckCircle2, CircleDollarSign, Clock3, Cuboid, type LucideIcon } from "lucide-react";

export type InvestmentTabId = "overview" | "products" | "active" | "matured" | "pending";
export const investmentTabs: { id: InvestmentTabId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Portfolio Overview", icon: BarChart3 },
  { id: "products", label: "Products", icon: Cuboid },
  { id: "active", label: "Active Investments", icon: Clock3 },
  { id: "matured", label: "Matured Investments", icon: CheckCircle2 },
  { id: "pending", label: "Pending Requests", icon: BriefcaseBusiness },
];

export type PortfolioSummaryItem = { label: string; value: string; detail?: string; icon: LucideIcon; positive?: boolean };
export const portfolioSummary: PortfolioSummaryItem[] = [
  { label: "Total Portfolio Value", value: "₦120,500,000", detail: "+8.4% vs. previous period", icon: BriefcaseBusiness, positive: true },
  { label: "Total Invested", value: "₦110,000,000", icon: CircleDollarSign },
  { label: "Total Returns (Earned)", value: "₦10,500,000", icon: BarChart3 },
  { label: "Active Investments", value: "5", detail: "2 products", icon: Cuboid },
];

export const portfolioPerformance = [
  { label: "Jan 2024", value: 75000000 }, { label: "Feb 2024", value: 77000000 }, { label: "Mar 2024", value: 84500000 }, { label: "Apr 2024", value: 92000000 }, { label: "May 2024", value: 100000000 }, { label: "Jun 2024", value: 110000000 }, { label: "30 Jun 2024", value: 120500000 },
] as const;

export const portfolioAllocation = [
  { label: "Starfetch Fixed Note", amount: "₦60,250,000", percent: 50, color: "#075038" },
  { label: "Discretionary Portfolio", amount: "₦36,150,000", percent: 30, color: "#12a77a" },
  { label: "Execution Mandate", amount: "₦18,075,000", percent: 15, color: "#bce9c8" },
  { label: "Cash / Unallocated Balance", amount: "₦6,025,000", percent: 5, color: "#ffbf1d" },
] as const;

export type InvestmentStatus = "Active" | "Matured" | "Pending Setup" | "Closed";
export type Investment = { id: string; product: "Starfetch Fixed Note" | "Discretionary Portfolio" | "Execution Mandate"; reference: string; amountInvested: string; currentValue: string; expectedReturn: string; startDate: string; maturityDate: string; status: InvestmentStatus; tenor: string };
export const investments: Investment[] = [
  { id: "inv-1", product: "Starfetch Fixed Note", reference: "SFN-2024-001", amountInvested: "₦30,000,000", currentValue: "₦32,400,000", expectedReturn: "12.0% p.a.", startDate: "15 Jan 2024", maturityDate: "15 Jan 2025", status: "Active", tenor: "12-month tenor" },
  { id: "inv-2", product: "Discretionary Portfolio", reference: "DPM-2024-002", amountInvested: "₦40,000,000", currentValue: "₦43,600,000", expectedReturn: "Variable", startDate: "10 Feb 2024", maturityDate: "Ongoing", status: "Active", tenor: "Actively managed" },
  { id: "inv-3", product: "Execution Mandate", reference: "EXM-2024-003", amountInvested: "₦20,000,000", currentValue: "₦20,700,000", expectedReturn: "Market dependent", startDate: "01 Mar 2024", maturityDate: "—", status: "Active", tenor: "Execution mandate" },
  { id: "inv-4", product: "Starfetch Fixed Note", reference: "SFN-2024-004", amountInvested: "₦20,000,000", currentValue: "₦21,275,000", expectedReturn: "12.0% p.a.", startDate: "01 Jun 2024", maturityDate: "01 Dec 2024", status: "Pending Setup", tenor: "6-month tenor" },
  { id: "inv-5", product: "Starfetch Fixed Note", reference: "SFN-2023-011", amountInvested: "₦12,000,000", currentValue: "₦12,000,000", expectedReturn: "11.0% p.a.", startDate: "15 May 2023", maturityDate: "15 May 2024", status: "Matured", tenor: "12-month tenor" },
];

export const products = [
  { name: "Starfetch Fixed Note", description: "A fixed-term investment solution with a defined return and maturity date.", mandate: "Fixed income / capital preservation", cta: "Start Investment" },
  { name: "Discretionary Portfolio", description: "Professionally managed investments aligned to your approved mandate and objectives.", mandate: "Discretionary mandate", cta: "View Details" },
  { name: "Execution Mandate", description: "A client-directed mandate executed with Starfetch support and market access.", mandate: "Execution-only mandate", cta: "View Details" },
] as const;

export const pendingRequests = [
  { id: "request-1", type: "New investment request", description: "Starfetch Fixed Note", submitted: "01 Jun 2024", status: "Pending Setup" },
  { id: "request-2", type: "Additional funding request", description: "Discretionary Portfolio", submitted: "20 Jun 2024", status: "Pending Setup" },
  { id: "request-3", type: "Mandate setup", description: "Execution Mandate", submitted: "25 Jun 2024", status: "Pending Setup" },
] as const;
