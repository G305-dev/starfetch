import Link from "next/link";
import { ArrowRight, ReceiptText } from "lucide-react";
import type { InvestorTransaction } from "@/lib/api/client";
import { formatCurrencyMinor, formatDashboardDate } from "./dashboard-formatters";
import { EmptyTransactionsPanel } from "./NewInvestorEmptyPanels";

function TransactionItem({ transaction }: { transaction: InvestorTransaction }) {
  return <li className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-star-50 text-star-700"><ReceiptText size={18} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-star-900">{transaction.type ?? "Transaction"}</p><p className="mt-0.5 truncate text-xs text-star-muted">{transaction.description ?? formatDashboardDate(transaction.occurredAt)}</p></div><div className="shrink-0 text-right"><p className="text-sm font-extrabold tabular-nums text-star-900">{formatCurrencyMinor(transaction.amountMinor, transaction.currency)}</p><p className="mt-0.5 text-xs text-star-muted">{transaction.status ?? formatDashboardDate(transaction.occurredAt)}</p></div></li>;
}

export function RecentTransactions({ transactions }: { transactions: InvestorTransaction[] }) {
  if (transactions.length === 0) return <EmptyTransactionsPanel />;
  return <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="recent-transactions-heading"><div className="flex items-center justify-between gap-4"><div><h2 id="recent-transactions-heading" className="text-lg font-extrabold text-star-900">Recent Transactions</h2><p className="mt-1 text-sm text-star-muted">Your latest account activity.</p></div><Link href="/transactions" className="inline-flex items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">View all <ArrowRight size={16} aria-hidden="true" /></Link></div><ul className="mt-5 divide-y divide-star-100" aria-label="Recent transactions">{transactions.map((transaction, index) => <TransactionItem key={transaction.id ?? `transaction-${index}`} transaction={transaction} />)}</ul></section>;
}
