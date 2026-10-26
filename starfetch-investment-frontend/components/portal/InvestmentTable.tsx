import { ArrowRight, Ellipsis } from "lucide-react";
import { investments } from "./dashboard-data";

function StatusBadge({ status }: { status: string }) {
  return <span className="inline-flex rounded-md bg-star-100 px-2.5 py-1 text-xs font-bold text-star-700">{status}</span>;
}

export function InvestmentTable() {
  return (
    <section id="my-investments" className="scroll-mt-24 rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="my-investments-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="my-investments-heading" className="text-lg font-extrabold text-star-900">My Investments</h2>
        <a href="/dashboard#my-investments" className="inline-flex items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
          View All <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>

      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[650px] text-left text-sm">
          <thead className="bg-star-50 text-xs font-bold text-star-muted">
            <tr>
              <th scope="col" className="rounded-l-md px-3 py-3 font-bold">Product</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Amount Invested</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Current Value</th>
              <th scope="col" className="px-3 py-3 text-right font-bold">Return</th>
              <th scope="col" className="px-3 py-3 text-center font-bold">Status</th>
              <th scope="col" className="rounded-r-md px-3 py-3"><span className="sr-only">Options</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-star-100">
            {investments.map(({ product, amountInvested, currentValue, returnValue, status, icon: Icon }) => (
              <tr key={product} className="transition hover:bg-star-50/60">
                <td className="px-3 py-4">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-star-50 text-star-700" aria-hidden="true"><Icon size={18} /></span>
                    <span className="font-bold text-star-900">{product}</span>
                  </div>
                </td>
                <td className="px-3 py-4 text-right font-semibold text-star-700">{amountInvested}</td>
                <td className="px-3 py-4 text-right font-semibold text-star-700">{currentValue}</td>
                <td className="px-3 py-4 text-right font-bold text-[#22953d]">↑ {returnValue}</td>
                <td className="px-3 py-4 text-center"><StatusBadge status={status} /></td>
                <td className="px-3 py-4 text-right"><button type="button" className="rounded p-1 text-star-muted transition hover:bg-star-100 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700" aria-label={`Options for ${product} are unavailable in this dashboard mockup`}><Ellipsis size={19} aria-hidden="true" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-3 md:hidden">
        {investments.map(({ product, amountInvested, currentValue, returnValue, status, icon: Icon }) => (
          <article key={product} className="rounded-lg border border-star-200 bg-star-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-star-700" aria-hidden="true"><Icon size={18} /></span>
                <h3 className="text-sm font-extrabold leading-5 text-star-900">{product}</h3>
              </div>
              <StatusBadge status={status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
              <div><dt className="text-star-muted">Amount Invested</dt><dd className="mt-1 font-bold text-star-700">{amountInvested}</dd></div>
              <div><dt className="text-star-muted">Current Value</dt><dd className="mt-1 font-bold text-star-700">{currentValue}</dd></div>
              <div><dt className="text-star-muted">Return</dt><dd className="mt-1 font-bold text-[#22953d]">↑ {returnValue}</dd></div>
            </dl>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-star-muted">All values on this dashboard are illustrative sample data.</p>
    </section>
  );
}
