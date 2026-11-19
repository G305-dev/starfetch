"use client";
import { AdminSectionCard } from "@/components/admin/AdminDataStates";
import { portfolioBySolution } from "./fixtures/admin-portfolios-data";

/** Executive solution totals are their own illustrative fixture, not the sum of
 * a deliberately tiny subset of sample investments. No activity, tabs or charts. */
export function AdminPortfoliosPage() {
  return <main className="mt-4">
    <AdminSectionCard className="min-w-0 p-4 sm:p-5">
      <div className="mb-4"><h2 className="text-base font-extrabold text-star-900">Portfolio Overview</h2>
        <p className="mt-1 text-xs text-[#697c6e]">Investment solution summary · Synthetic illustrative aggregates (not live values or the sum of demo investment entries).</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#e5ece4]">
        <table className="w-full min-w-[540px] border-collapse text-left" aria-label="Investment solutions portfolio overview">
          <thead className="bg-[#f3f7f1] text-xs text-[#526157]"><tr><th scope="col" className="px-4 py-4 font-extrabold">Investment Solution</th><th scope="col" className="px-4 py-4 text-right font-extrabold">Amount Invested</th><th scope="col" className="px-4 py-4 text-right font-extrabold">Current Value</th></tr></thead>
          <tbody className="divide-y divide-[#e9eee8]">{portfolioBySolution.map(item => <tr key={item.solution} className="text-xs font-semibold text-[#233b2a] hover:bg-[#f7faf5]"><td className="px-4 py-4">{item.solution}</td><td className="px-4 py-4 text-right tabular-nums">{item.invested}</td><td className="px-4 py-4 text-right tabular-nums">{item.current}</td></tr>)}</tbody>
        </table>
      </div>
    </AdminSectionCard>
  </main>;
}
