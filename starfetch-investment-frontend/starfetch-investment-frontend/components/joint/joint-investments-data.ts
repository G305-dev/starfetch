export type JointInvestmentStatus = "Active" | "Matured" | "Pending" | "Closed";
export type JointInvestmentFilter = "active" | "matured" | "all";

/** Frontend-only mock data for the joint account investments experience. */
export const jointInvestmentPageCopy = {
  title: "My Investments",
  description: "View and manage all your joint investments with Starfetch.",
  listTitle: "Your Investments",
  listDescription: "A list of your current and past investments with Starfetch.",
  emptyTitle: "No investments yet",
  emptyDescription: "Your joint account does not have any active investments yet.",
  exploreTitle: "Explore more investment opportunities",
  exploreDescription: "Grow your joint portfolio with our curated investment solutions tailored to your goals.",
} as const;

export const jointInvestmentSummary = [
  { id: "total-invested", label: "Total Invested", value: "₦45,000,000", detail: "Across 3 investments", tone: "neutral" },
  { id: "current-value", label: "Current Value", value: "₦52,480,000", detail: "Portfolio market value", tone: "neutral" },
  { id: "returns-ytd", label: "Total Returns (YTD)", value: "₦7,480,000", detail: "+16.6%", tone: "positive" },
  { id: "active-investments", label: "Active Investments", value: "3", detail: "All currently active", tone: "neutral" },
] as const;

export const jointInvestmentFilterTabs: ReadonlyArray<{ id: JointInvestmentFilter; label: string; count: number }> = [
  { id: "active", label: "Active", count: 3 },
  { id: "matured", label: "Matured", count: 0 },
  { id: "all", label: "All", count: 3 },
];

export type JointInvestment = {
  id: "fixed-note" | "discretionary-portfolio" | "execution-mandate";
  productName: "Starfetch Fixed Note" | "Discretionary Portfolio" | "Execution Mandate";
  description: string;
  amountInvested: string;
  currentValue: string;
  returnPercentage: string;
  maturityDate: string;
  status: JointInvestmentStatus;
};

export const jointInvestments: ReadonlyArray<JointInvestment> = [
  {
    id: "fixed-note",
    productName: "Starfetch Fixed Note",
    description: "12-Month, 15.0% p.a.",
    amountInvested: "₦20,000,000",
    currentValue: "₦23,000,000",
    returnPercentage: "+15.0%",
    maturityDate: "Dec 28, 2026",
    status: "Active",
  },
  {
    id: "discretionary-portfolio",
    productName: "Discretionary Portfolio",
    description: "Multi-asset (Balanced)",
    amountInvested: "₦15,000,000",
    currentValue: "₦17,250,000",
    returnPercentage: "+15.0%",
    maturityDate: "—",
    status: "Active",
  },
  {
    id: "execution-mandate",
    productName: "Execution Mandate",
    description: "Managed investments (Tactical)",
    amountInvested: "₦10,000,000",
    currentValue: "₦12,230,000",
    returnPercentage: "+22.3%",
    maturityDate: "—",
    status: "Active",
  },
];
