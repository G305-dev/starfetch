export type JointTransactionStatus = "Completed" | "Pending" | "Processing" | "Failed";
export type JointTransactionCategory = "all" | "investments" | "returns" | "withdrawals" | "transfers";
export type JointTransactionDateRange = "all" | "last-7-days" | "last-30-days" | "last-3-months" | "custom";
export type JointTransactionProduct = "Starfetch Fixed Note" | "Discretionary Portfolio" | "Execution Mandate" | "Joint Account Cash Balance";

export type JointTransaction = {
  id: string;
  reference: string;
  date: string;
  dateValue: string;
  category: Exclude<JointTransactionCategory, "all">;
  type: "Investment Funded" | "Returns Received" | "Return Distribution" | "Withdrawal" | "Transfer";
  product: JointTransactionProduct;
  amount: string;
  status: JointTransactionStatus;
  approvalStatus: "No Joint Approval Required" | "Awaiting Applicant 2 Approval" | "Approved by Both Holders" | "Rejected";
  notes: string;
  processingDate?: string;
  requiresJointApproval: boolean;
};

/** Frontend-only mock data for the joint account transactions experience. */
export const jointTransactionPageCopy = {
  title: "Transactions",
  description: "View and track all activity on your joint investment account.",
  emptyTitle: "No transactions yet",
  emptyDescription: "Activity on your joint account will appear here once you start investing.",
} as const;

export const jointTransactionSummary = [
  { id: "total-transactions", label: "Total Transactions", value: "18", detail: "All transaction activity", tone: "neutral" },
  { id: "total-investments", label: "Total Investments", value: "₦45,000,000", detail: "Across 6 funded investments", tone: "neutral" },
  { id: "total-returns", label: "Total Returns Received", value: "₦7,480,000", detail: "+16.6%", tone: "positive" },
  { id: "total-withdrawals", label: "Total Withdrawals", value: "₦2,500,000", detail: "Across 3 withdrawals", tone: "neutral" },
] as const;

export const jointTransactionTabs: ReadonlyArray<{ id: JointTransactionCategory; label: string; count: number }> = [
  { id: "all", label: "All Transactions", count: 18 },
  { id: "investments", label: "Investments", count: 6 },
  { id: "returns", label: "Returns", count: 5 },
  { id: "withdrawals", label: "Withdrawals", count: 3 },
  { id: "transfers", label: "Transfers", count: 4 },
];

export const jointTransactionProductOptions = ["All Products", "Starfetch Fixed Note", "Discretionary Portfolio", "Execution Mandate"] as const;
export const jointTransactionStatusOptions = ["All Statuses", "Completed", "Pending", "Processing", "Failed"] as const;
export const jointTransactionDateRangeOptions: ReadonlyArray<{ id: JointTransactionDateRange; label: string }> = [
  { id: "all", label: "All Time" },
  { id: "last-7-days", label: "Last 7 Days" },
  { id: "last-30-days", label: "Last 30 Days" },
  { id: "last-3-months", label: "Last 3 Months" },
  { id: "custom", label: "Custom Range" },
];

/** Fixed local reference date keeps mock date-range filtering deterministic. */
export const jointTransactionDateReference = "2026-11-02";

export const jointTransactions: ReadonlyArray<JointTransaction> = [
  { id: "joint-txn-001", reference: "TXN-2026-001", date: "Nov 01, 2026", dateValue: "2026-11-01", category: "investments", type: "Investment Funded", product: "Starfetch Fixed Note", amount: "₦5,000,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Additional allocation to the joint fixed-note position.", processingDate: "Nov 01, 2026", requiresJointApproval: true },
  { id: "joint-txn-002", reference: "TXN-2026-002", date: "Oct 28, 2026", dateValue: "2026-10-28", category: "returns", type: "Returns Received", product: "Discretionary Portfolio", amount: "₦2,250,000", status: "Completed", approvalStatus: "No Joint Approval Required", notes: "Scheduled portfolio return credited to the joint account.", processingDate: "Oct 28, 2026", requiresJointApproval: false },
  { id: "joint-txn-003", reference: "TXN-2026-003", date: "Oct 25, 2026", dateValue: "2026-10-25", category: "investments", type: "Investment Funded", product: "Execution Mandate", amount: "₦10,000,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Tactical mandate allocation confirmed by both account holders.", processingDate: "Oct 25, 2026", requiresJointApproval: true },
  { id: "joint-txn-004", reference: "TXN-2026-004", date: "Oct 20, 2026", dateValue: "2026-10-20", category: "withdrawals", type: "Withdrawal", product: "Starfetch Fixed Note", amount: "₦1,500,000", status: "Processing", approvalStatus: "Awaiting Applicant 2 Approval", notes: "Partial withdrawal request from the fixed-note investment.", requiresJointApproval: true },
  { id: "joint-txn-005", reference: "TXN-2026-005", date: "Oct 15, 2026", dateValue: "2026-10-15", category: "returns", type: "Return Distribution", product: "Discretionary Portfolio", amount: "₦1,200,000", status: "Completed", approvalStatus: "No Joint Approval Required", notes: "Quarterly discretionary portfolio distribution.", processingDate: "Oct 15, 2026", requiresJointApproval: false },
  { id: "joint-txn-006", reference: "TXN-2026-006", date: "Oct 10, 2026", dateValue: "2026-10-10", category: "transfers", type: "Transfer", product: "Joint Account Cash Balance", amount: "₦500,000", status: "Pending", approvalStatus: "Awaiting Applicant 2 Approval", notes: "Internal transfer from the joint account cash balance.", requiresJointApproval: true },
  { id: "joint-txn-007", reference: "TXN-2026-007", date: "Oct 04, 2026", dateValue: "2026-10-04", category: "investments", type: "Investment Funded", product: "Starfetch Fixed Note", amount: "₦7,500,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Joint fixed-note investment funding completed.", processingDate: "Oct 04, 2026", requiresJointApproval: true },
  { id: "joint-txn-008", reference: "TXN-2026-008", date: "Sep 28, 2026", dateValue: "2026-09-28", category: "returns", type: "Returns Received", product: "Discretionary Portfolio", amount: "₦1,500,000", status: "Completed", approvalStatus: "No Joint Approval Required", notes: "Monthly portfolio returns received.", processingDate: "Sep 28, 2026", requiresJointApproval: false },
  { id: "joint-txn-009", reference: "TXN-2026-009", date: "Sep 22, 2026", dateValue: "2026-09-22", category: "investments", type: "Investment Funded", product: "Discretionary Portfolio", amount: "₦5,000,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Balanced multi-asset portfolio allocation.", processingDate: "Sep 22, 2026", requiresJointApproval: true },
  { id: "joint-txn-010", reference: "TXN-2026-010", date: "Sep 18, 2026", dateValue: "2026-09-18", category: "withdrawals", type: "Withdrawal", product: "Execution Mandate", amount: "₦600,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Approved withdrawal from managed investment proceeds.", processingDate: "Sep 18, 2026", requiresJointApproval: true },
  { id: "joint-txn-011", reference: "TXN-2026-011", date: "Sep 10, 2026", dateValue: "2026-09-10", category: "transfers", type: "Transfer", product: "Joint Account Cash Balance", amount: "₦750,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Joint cash balance transfer confirmed by both holders.", processingDate: "Sep 10, 2026", requiresJointApproval: true },
  { id: "joint-txn-012", reference: "TXN-2026-012", date: "Sep 04, 2026", dateValue: "2026-09-04", category: "returns", type: "Return Distribution", product: "Execution Mandate", amount: "₦930,000", status: "Completed", approvalStatus: "No Joint Approval Required", notes: "Execution mandate return distribution.", processingDate: "Sep 04, 2026", requiresJointApproval: false },
  { id: "joint-txn-013", reference: "TXN-2026-013", date: "Aug 25, 2026", dateValue: "2026-08-25", category: "investments", type: "Investment Funded", product: "Execution Mandate", amount: "₦12,500,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Tactical mandate capital allocation completed.", processingDate: "Aug 25, 2026", requiresJointApproval: true },
  { id: "joint-txn-014", reference: "TXN-2026-014", date: "Aug 20, 2026", dateValue: "2026-08-20", category: "returns", type: "Returns Received", product: "Starfetch Fixed Note", amount: "₦900,000", status: "Completed", approvalStatus: "No Joint Approval Required", notes: "Fixed-note coupon return received.", processingDate: "Aug 20, 2026", requiresJointApproval: false },
  { id: "joint-txn-015", reference: "TXN-2026-015", date: "Aug 12, 2026", dateValue: "2026-08-12", category: "withdrawals", type: "Withdrawal", product: "Starfetch Fixed Note", amount: "₦400,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Partial withdrawal request completed.", processingDate: "Aug 12, 2026", requiresJointApproval: true },
  { id: "joint-txn-016", reference: "TXN-2026-016", date: "Aug 08, 2026", dateValue: "2026-08-08", category: "transfers", type: "Transfer", product: "Joint Account Cash Balance", amount: "₦300,000", status: "Failed", approvalStatus: "Rejected", notes: "Local mock transfer record marked as failed.", requiresJointApproval: true },
  { id: "joint-txn-017", reference: "TXN-2026-017", date: "Jul 29, 2026", dateValue: "2026-07-29", category: "investments", type: "Investment Funded", product: "Execution Mandate", amount: "₦5,000,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Managed tactical allocation funded.", processingDate: "Jul 29, 2026", requiresJointApproval: true },
  { id: "joint-txn-018", reference: "TXN-2026-018", date: "Jul 15, 2026", dateValue: "2026-07-15", category: "transfers", type: "Transfer", product: "Joint Account Cash Balance", amount: "₦200,000", status: "Completed", approvalStatus: "Approved by Both Holders", notes: "Internal joint cash balance transfer completed.", processingDate: "Jul 15, 2026", requiresJointApproval: true },
];
