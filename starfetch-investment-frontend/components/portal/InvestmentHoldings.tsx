"use client";

import { ArrowDown, ArrowUp, Ellipsis } from "lucide-react";
import type { InvestmentHolding, InvestmentStatus } from "./investments-data";
import { InvestmentsEmptyState } from "./InvestmentStates";

type InvestmentHoldingsProps = {
  investments: InvestmentHolding[];
  filtered?: boolean;
};

function StatusBadge({ status }: { status: InvestmentStatus }) {
  const styles: Record<InvestmentStatus, string> = {
    Active: "bg-star-100 text-star-700",
    Pending: "bg-[#fff4d8] text-[#8a6510]",
    Matured: "bg-[#fff8e8] text-[#75602a]",
    Closed: "bg-star-100 text-star-muted",
  };

  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${styles[status]}`}>{status}</span>;
}

function ReturnValue({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-1 font-extrabold ${positive ? "text-[#22953d]" : "text-[#bd4d4d]"}`}>
      {positive ? <ArrowUp size={16} strokeWidth={2.5} aria-hidden="true" /> : <ArrowDown size={16} strokeWidth={2.5} aria-hidden="true" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function InvestmentActionsMenu({ product }: { product: string }) {
  return (
    <details className="relative inline-block">
      <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-md text-star-muted transition hover:bg-star-100 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 [&::-webkit-details-marker]:hidden" aria-label={`Actions for ${product}`}>
        <Ellipsis size={20} aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-star-200 bg-white p-1.5 text-left shadow-card">
        {['View Details', 'View Transactions', 'View Statement'].map((label) => (
          <button key={label} type="button" disabled title="Available after portal API integration" className="block w-full rounded px-3 py-2 text-left text-xs font-bold text-star-muted disabled:cursor-not-allowed disabled:opacity-75">
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function InvestmentHoldings({ investments, filtered = false }: InvestmentHoldingsProps) {
  if (investments.length === 0) return <InvestmentsEmptyState filtered={filtered} />;

  return (
    <>
      <div className="mt-5 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-star-50 text-xs text-star-muted">
            <tr>
              <th scope="col" className="rounded-l-md px-5 py-4 font-bold">Product</th>
              <th scope="col" className="px-4 py-4 text-right font-bold">Amount Invested</th>
              <th scope="col" className="px-4 py-4 text-right font-bold">Current Value</th>
              <th scope="col" className="px-4 py-4 text-right font-bold">Return</th>
              <th scope="col" className="px-4 py-4 text-center font-bold">Status</th>
              <th scope="col" className="rounded-r-md px-4 py-4 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-star-100">
            {investments.map(({ id, product, description, amountInvested, currentValue, returnPercent, status, icon: Icon }) => (
              <tr key={id} className="transition hover:bg-star-50/60">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-star-50 text-star-700" aria-hidden="true"><Icon size={21} strokeWidth={1.9} /></span>
                    <div><p className="font-extrabold text-star-900">{product}</p><p className="mt-0.5 text-xs text-star-muted">{description}</p></div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right font-semibold tabular-nums text-star-700">{amountInvested}</td>
                <td className="px-4 py-4 text-right font-semibold tabular-nums text-star-700">{currentValue}</td>
                <td className="px-4 py-4 text-right"><ReturnValue value={returnPercent} /></td>
                <td className="px-4 py-4 text-center"><StatusBadge status={status} /></td>
                <td className="px-4 py-4 text-right"><InvestmentActionsMenu product={product} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 lg:hidden">
        {investments.map(({ id, product, description, amountInvested, currentValue, returnPercent, status, icon: Icon }) => (
          <article key={id} className="rounded-xl border border-star-200 bg-star-50 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-star-700" aria-hidden="true"><Icon size={21} strokeWidth={1.9} /></span>
                <div className="min-w-0"><h3 className="text-sm font-extrabold text-star-900">{product}</h3><p className="mt-0.5 text-xs text-star-muted">{description}</p></div>
              </div>
              <InvestmentActionsMenu product={product} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <div><dt className="text-xs text-star-muted">Amount Invested</dt><dd className="mt-1 font-bold tabular-nums text-star-700">{amountInvested}</dd></div>
              <div><dt className="text-xs text-star-muted">Current Value</dt><dd className="mt-1 font-bold tabular-nums text-star-700">{currentValue}</dd></div>
              <div><dt className="text-xs text-star-muted">Return</dt><dd className="mt-1"><ReturnValue value={returnPercent} /></dd></div>
              <div><dt className="text-xs text-star-muted">Status</dt><dd className="mt-1"><StatusBadge status={status} /></dd></div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
