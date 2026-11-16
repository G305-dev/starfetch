import { CheckCircle2, Clock3, Eye, XCircle, AlertCircle, LoaderCircle, type LucideIcon } from "lucide-react";
import type { AccountType, VerificationStatus } from "./admin-dashboard-data";

export type InvestmentStatus = "Active" | "Under Review" | "Pending Funding" | "Matured" | "Closed";
export type TransactionStatus = "Completed" | "Pending Approval" | "Under Review" | "Processing" | "Failed" | "Flagged";
export type PortfolioStatus = "Active" | "Maturing Soon" | "Matured" | "Closed";
export function AdminStatusBadge({ status }: { status: VerificationStatus | InvestmentStatus | TransactionStatus | PortfolioStatus }) {
  const colors: Record<VerificationStatus | InvestmentStatus | TransactionStatus | PortfolioStatus, string> = { "Maturing Soon": "bg-amber-100 text-amber-800", Completed: "bg-green-100 text-green-800", "Pending Approval": "bg-amber-100 text-amber-800", Processing: "bg-blue-100 text-blue-800", Failed: "bg-red-100 text-red-800", Flagged: "bg-red-100 text-red-800", Active: "bg-green-100 text-green-800", "Pending Funding": "bg-amber-100 text-amber-800", Matured: "bg-slate-100 text-slate-700", Closed: "bg-slate-100 text-slate-700", Pending: "bg-amber-100 text-amber-800", "Pending Review": "bg-amber-100 text-amber-800", Incomplete: "bg-amber-100 text-amber-800", "Under Review": "bg-blue-100 text-blue-800", Verified: "bg-green-100 text-green-800", Rejected: "bg-red-100 text-red-800" };
  const icons: Partial<Record<VerificationStatus | InvestmentStatus | TransactionStatus | PortfolioStatus, LucideIcon>> = { "Maturing Soon": Clock3, Completed: CheckCircle2, "Pending Approval": Clock3, Processing: LoaderCircle, Failed: XCircle, Flagged: AlertCircle, "Pending Review": Clock3, "Under Review": Eye, Verified: CheckCircle2, Rejected: XCircle };
  const Icon = icons[status];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${colors[status]}`}>{Icon && <Icon size={11} aria-hidden="true"/>}{status}</span>;
}
export function AdminAccountTypeBadge({ type }: { type: AccountType }) {
  const colors: Record<AccountType, string> = { Individual: "bg-[#edf6e7] text-[#325c37]", Joint: "bg-blue-50 text-blue-800", Corporate: "bg-purple-50 text-purple-800" };
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${colors[type]}`}>{type}</span>;
}

export type AccountStatus = "Active" | "Restricted" | "Suspended" | "Pending";
export function AdminAccountStatusBadge({ status }: { status: AccountStatus }) {
  const colors: Record<AccountStatus, string> = { Active: "bg-green-100 text-green-800", Restricted: "bg-red-100 text-red-800", Suspended: "bg-red-100 text-red-800", Pending: "bg-amber-100 text-amber-800" };
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${colors[status]}`}>{status}</span>;
}
