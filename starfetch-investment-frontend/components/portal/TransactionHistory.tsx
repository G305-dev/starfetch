"use client";

import { Ellipsis } from "lucide-react";
import type { PortalTransaction, TransactionStatus } from "./transactions-data";
import { TransactionsEmptyState } from "./TransactionStates";

type TransactionHistoryProps = {
  transactions: PortalTransaction[];
  filtered?: boolean;
};

function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  const styles: Record<TransactionStatus, string> = {
    Successful: "bg-star-100 text-star-700",
    Pending: "bg-[#fff4d8] text-[#8a6510]",
    Failed: "bg-[#feeaea] text-[#a33f3f]",
  };
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${styles[status]}`}>{status}</span>;
}

function TransactionActionsMenu({ transactionId }: { transactionId: string }) {
  return (
    <details className="relative inline-block">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-md text-star-muted transition hover:bg-star-100 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 [&::-webkit-details-marker]:hidden" aria-label={`Actions for ${transactionId}`}>
        <Ellipsis size={20} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-star-200 bg-white p-1.5 text-left shadow-card">
        {['View Details', 'Download Receipt', 'View Related Investment'].map((label) => <button key={label} type="button" disabled title="Available after portal API integration" className="block w-full rounded px-3 py-2 text-left text-xs font-bold text-star-muted disabled:cursor-not-allowed disabled:opacity-75">{label}</button>)}
      </div>
    </details>
  );
}

export function TransactionHistory({ transactions, filtered = false }: TransactionHistoryProps) {
  if (transactions.length === 0) return <TransactionsEmptyState filtered={filtered} />;

  return (
    <section className="rounded-xl border border-star-200 bg-white p-4 sm:p-6" aria-labelledby="transaction-history-heading">
      <h2 id="transaction-history-heading" className="text-lg font-extrabold text-star-900">Transaction History</h2>
      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-star-50 text-xs text-star-muted">
            <tr>
              <th scope="col" className="rounded-l-md px-4 py-4 font-bold">Transaction ID</th>
              <th scope="col" className="px-4 py-4 font-bold">Type</th>
              <th scope="col" className="px-4 py-4 font-bold">Product</th>
              <th scope="col" className="px-4 py-4 font-bold">Date</th>
              <th scope="col" className="px-4 py-4 text-right font-bold">Amount</th>
              <th scope="col" className="px-4 py-4 text-center font-bold">Status</th>
              <th scope="col" className="rounded-r-md px-4 py-4 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-star-100">
            {transactions.map(({ id, type, product, date, amount, status, icon: Icon }) => (
              <tr key={id} className="transition hover:bg-star-50/60">
                <td className="px-4 py-4 font-bold text-star-700">{id}</td>
                <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-star-50 text-star-700" aria-hidden="true"><Icon size={16} strokeWidth={2.1} /></span><span className="font-semibold text-star-900">{type}</span></span></td>
                <td className="px-4 py-4 font-semibold text-star-700">{product}</td>
                <td className="px-4 py-4 text-star-muted">{date}</td>
                <td className="px-4 py-4 text-right font-extrabold tabular-nums text-star-700">{amount}</td>
                <td className="px-4 py-4 text-center"><TransactionStatusBadge status={status} /></td>
                <td className="px-4 py-4 text-right"><TransactionActionsMenu transactionId={id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 lg:hidden">
        {transactions.map(({ id, type, product, date, amount, status, icon: Icon }) => (
          <article key={id} className="rounded-xl border border-star-200 bg-star-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-star-700" aria-hidden="true"><Icon size={19} strokeWidth={2.1} /></span><div className="min-w-0"><p className="text-xs font-bold text-star-muted">{id}</p><h3 className="mt-1 text-sm font-extrabold text-star-900">{type}</h3><p className="mt-0.5 text-xs text-star-muted">{product}</p></div></div>
              <TransactionActionsMenu transactionId={id} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><div><dt className="text-xs text-star-muted">Date</dt><dd className="mt-1 font-semibold text-star-700">{date}</dd></div><div><dt className="text-xs text-star-muted">Amount</dt><dd className="mt-1 font-extrabold tabular-nums text-star-700">{amount}</dd></div><div><dt className="text-xs text-star-muted">Status</dt><dd className="mt-1"><TransactionStatusBadge status={status} /></dd></div></dl>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-star-muted">All transaction records shown are temporary frontend mock data.</p>
    </section>
  );
}
