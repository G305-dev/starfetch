import { BarChart3, BriefcaseBusiness, HandCoins, TrendingUp, WalletCards, type LucideIcon } from "lucide-react";

/**
 * Temporary local data for the My Investments frontend mockup.
 * Replace with David's approved holdings, valuation, status, and pagination API responses later.
 */
export type InvestmentStatus = "Active" | "Matured" | "Pending" | "Closed";

export type InvestmentHolding = {
  id: string;
  product: string;
  investmentType: "Fixed Note" | "Discretionary Portfolio" | "Execution Mandate";
  description: string;
  amountInvested: string;
  currentValue: string;
  returnPercent: number;
  status: InvestmentStatus;
  icon: LucideIcon;
};

export const investmentSummary = [
  {
    label: "Total Invested",
    value: "₦10,000,000",
    trend: "8.4%",
    context: "since inception",
    icon: WalletCards,
    emphasis: true,
  },
  {
    label: "Current Value",
    value: "₦10,850,000",
    trend: "8.5%",
    context: "market growth",
    icon: BarChart3,
    emphasis: false,
  },
  {
    label: "Total Returns (YTD)",
    value: "₦850,000",
    trend: "12.5%",
    context: "year to date",
    icon: TrendingUp,
    emphasis: false,
  },
] as const;

export const investmentHoldings: InvestmentHolding[] = [
  {
    id: "fixed-note",
    product: "Starfetch Fixed Note",
    investmentType: "Fixed Note",
    description: "Fixed income solution",
    amountInvested: "₦5,000,000",
    currentValue: "₦5,600,000",
    returnPercent: 12,
    status: "Active",
    icon: BriefcaseBusiness,
  },
  {
    id: "discretionary-portfolios",
    product: "Starfetch Discretionary Portfolios",
    investmentType: "Discretionary Portfolio",
    description: "Managed by Starfetch",
    amountInvested: "₦3,000,000",
    currentValue: "₦3,300,000",
    returnPercent: 10,
    status: "Active",
    icon: TrendingUp,
  },
  {
    id: "execution-mandate",
    product: "Starfetch Execution Mandate",
    investmentType: "Execution Mandate",
    description: "Professional market execution",
    amountInvested: "₦2,000,000",
    currentValue: "₦2,200,000",
    returnPercent: 10,
    status: "Active",
    icon: HandCoins,
  },
];

export const investmentTypeOptions = ["All Investments", "Fixed Note", "Discretionary Portfolio", "Execution Mandate"] as const;
export const investmentStatusOptions = ["All Status", "Active", "Matured", "Pending", "Closed"] as const;
