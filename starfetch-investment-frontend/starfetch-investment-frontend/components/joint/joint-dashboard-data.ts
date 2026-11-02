export type JointPerformanceFilter = "1M" | "3M" | "6M" | "YTD" | "1Y" | "All";

/** Frontend-only mock data for the joint investor dashboard. */
export const jointAccount = {
  accountLabel: "Your Starfetch Investment Limited Joint Investment Account",
  accountNumber: "JIA-2026-0482",
};

export const jointAccountHolders = [
  { id: "applicant-1", name: "Amara Okeke", firstName: "Amara", initials: "AO", role: "Joint Account Holder" },
  { id: "applicant-2", name: "Daniel Musa", firstName: "Daniel", initials: "DM", role: "Joint Account Holder" },
] as const;

export const portfolioSummary = [
  { id: "portfolio-value", label: "Total Portfolio Value", value: "₦52,480,000", detail: "+14.8% vs. last year", tone: "positive" },
  { id: "total-invested", label: "Total Invested", value: "₦45,000,000", detail: "Across 3 investments", tone: "neutral" },
  { id: "returns-ytd", label: "Total Returns (YTD)", value: "₦7,480,000", detail: "+16.6%", tone: "positive" },
  { id: "active-investments", label: "Active Investments", value: "3", detail: "All currently active", tone: "neutral" },
] as const;

export const portfolioPerformance: Record<JointPerformanceFilter, ReadonlyArray<{ label: string; value: number }>> = {
  "1M": [{ label: "Week 1", value: 50.2 }, { label: "Week 2", value: 50.7 }, { label: "Week 3", value: 51.3 }, { label: "Week 4", value: 52.48 }],
  "3M": [{ label: "Apr", value: 47.4 }, { label: "May", value: 49.6 }, { label: "Jun", value: 52.48 }],
  "6M": [{ label: "Jan", value: 43.2 }, { label: "Feb", value: 44.8 }, { label: "Mar", value: 46.3 }, { label: "Apr", value: 47.4 }, { label: "May", value: 49.6 }, { label: "Jun", value: 52.48 }],
  YTD: [{ label: "Jan", value: 45.0 }, { label: "Feb", value: 45.7 }, { label: "Mar", value: 46.9 }, { label: "Apr", value: 48.2 }, { label: "May", value: 50.1 }, { label: "Jun", value: 52.48 }],
  "1Y": [{ label: "Jul", value: 38.8 }, { label: "Sep", value: 40.5 }, { label: "Nov", value: 42.2 }, { label: "Jan", value: 45.0 }, { label: "Mar", value: 46.9 }, { label: "May", value: 50.1 }, { label: "Jun", value: 52.48 }],
  All: [{ label: "2023", value: 31.2 }, { label: "Q1 2024", value: 37.6 }, { label: "Q3 2024", value: 42.5 }, { label: "2025", value: 46.1 }, { label: "Jan", value: 45.0 }, { label: "Jun", value: 52.48 }],
};

export const performanceSummary = [
  { label: "YTD Return", value: "+16.6%", positive: true },
  { label: "Total Gain (YTD)", value: "₦7,480,000", positive: false },
  { label: "Invested", value: "₦45,000,000", positive: false },
  { label: "Current Value", value: "₦52,480,000", positive: false },
] as const;

export const signingMandate = {
  selected: "Both Holders to Sign",
  description: "Both holders must approve account instructions before they are processed.",
  supportedRules: ["Either Holder to Sign", "Both Holders to Sign"],
} as const;

export const accountVerification = {
  status: "Verified" as const,
  supportedStatuses: ["Profile Incomplete", "Verification Pending", "Action Required", "Verified"],
};

export const investments = [
  { id: "fixed-note", product: "Starfetch Fixed Note", amountInvested: "₦20,000,000", currentValue: "₦23,000,000", returns: "+15.0%", status: "Active" as const },
  { id: "discretionary", product: "Discretionary Portfolio", amountInvested: "₦15,000,000", currentValue: "₦17,250,000", returns: "+15.0%", status: "Active" as const },
  { id: "execution", product: "Execution Mandate", amountInvested: "₦10,000,000", currentValue: "₦12,230,000", returns: "+22.3%", status: "Active" as const },
] as const;

export const recentTransactions = [
  { id: "transaction-1", title: "Investment Funded", detail: "Starfetch Fixed Note", date: "18 Jun 2026", amount: "₦20,000,000", type: "amount" as const },
  { id: "transaction-2", title: "Returns Received", detail: "Discretionary Portfolio", date: "05 Jun 2026", amount: "₦2,250,000", type: "amount" as const },
  { id: "transaction-3", title: "Document Uploaded", detail: "Joint account document", date: "28 May 2026", amount: "Completed", type: "status" as const },
  { id: "transaction-4", title: "Investment Funded", detail: "Execution Mandate", date: "12 May 2026", amount: "₦10,000,000", type: "amount" as const },
] as const;
