import { ReceiptText } from "lucide-react";
import type { InvestorTransaction } from "@/lib/api/client";
import { formatCurrencyMinor, formatDashboardDate } from "./dashboard-formatters";
import { TransactionsEmptyState } from "./TransactionStates";

type TransactionHistoryProps = {
  transactions: InvestorTransaction[];
  filtered?: boolean;
};

function TransactionStatusBadge({ status }: { status: string | null }) {
  return <span className="inline-flex rounded-md bg-star-100 px-2.5 py-1 text-xs font-bold text-star-700">{status ?? "Not available"}</span>;
}

function TransactionDescription({ value }: { value: string | null }) {
  return <span className="text-star-muted">{value ?? "Not available"}</span>;
}

export function TransactionHistory({ transactions, filtered = false }: TransactionHistoryProps) {
  if (transactions.length === 0) return <TransactionsEmptyState filtered={filtered} />;

  return <section className="rounded-xl border border-star-200 bg-white p-4 sm:p-6" aria-labelledby="transaction-history-heading"><h2 id="transaction-history-heading" className="text-lg font-extrabold text-star-900">Transaction History</h2><div className="mt-5 hidden overflow-x-auto lg:block"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-star-50 text-xs text-star-muted"><tr><th scope="col" className="rounded-l-md px-4 py-4 font-bold">Transaction ID</th><th scope="col" className="px-4 py-4 font-bold">Type</th><th scope="col" className="px-4 py-4 font-bold">Description</th><th scope="col" className="px-4 py-4 font-bold">Date</th><th scope="col" className="px-4 py-4 text-right font-bold">Amount</th><th scope="col" className="rounded-r-md px-4 py-4 text-center font-bold">Status</th></tr></thead><tbody className="divide-y divide-star-100">{transactions.map((transaction, index) => <tr key={transaction.id ?? `transaction-${index}`} className="transition hover:bg-star-50/60"><td className="px-4 py-4 font-bold text-star-700">{transaction.id ?? "Not available"}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-star-50 text-star-700" aria-hidden="true"><ReceiptText size={16} strokeWidth={2.1} /></span><span className="font-semibold text-star-900">{transaction.type ?? "Not available"}</span></span></td><td className="max-w-[18rem] px-4 py-4"><TransactionDescription value={transaction.description} /></td><td className="px-4 py-4 text-star-muted">{formatDashboardDate(transaction.occurredAt)}</td><td className="px-4 py-4 text-right font-extrabold tabular-nums text-star-700">{formatCurrencyMinor(transaction.amountMinor, transaction.currency)}</td><td className="px-4 py-4 text-center"><TransactionStatusBadge status={transaction.status} /></td></tr>)}</tbody></table></div><div className="mt-5 grid gap-3 lg:hidden">{transactions.map((transaction, index) => <article key={transaction.id ?? `transaction-${index}`} className="rounded-xl border border-star-200 bg-star-50 p-4"><div className="flex min-w-0 gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-star-700" aria-hidden="true"><ReceiptText size={19} strokeWidth={2.1} /></span><div className="min-w-0"><p className="text-xs font-bold text-star-muted">{transaction.id ?? "Not available"}</p><h3 className="mt-1 text-sm font-extrabold text-star-900">{transaction.type ?? "Not available"}</h3><p className="mt-0.5 text-xs leading-5 text-star-muted"><TransactionDescription value={transaction.description} /></p></div></div><dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><div><dt className="text-xs text-star-muted">Date</dt><dd className="mt-1 font-semibold text-star-700">{formatDashboardDate(transaction.occurredAt)}</dd></div><div><dt className="text-xs text-star-muted">Amount</dt><dd className="mt-1 font-extrabold tabular-nums text-star-700">{formatCurrencyMinor(transaction.amountMinor, transaction.currency)}</dd></div><div><dt className="text-xs text-star-muted">Status</dt><dd className="mt-1"><TransactionStatusBadge status={transaction.status} /></dd></div></dl></article>)}</div></section>;
}
