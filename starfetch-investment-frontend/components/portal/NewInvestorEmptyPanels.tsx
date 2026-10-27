import { ArrowRight, BarChart3, FileText } from "lucide-react";

export function EmptyInvestmentsPanel() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="empty-investments-heading">
      <div className="flex items-center justify-between gap-4"><h2 id="empty-investments-heading" className="text-lg font-extrabold text-star-900">My Investments</h2><a href="/investments" className="inline-flex items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">View all <ArrowRight size={16} aria-hidden="true" /></a></div>
      <div className="flex min-h-[230px] flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-star-50 text-star-300" aria-hidden="true"><BarChart3 size={32} /></span><h3 className="mt-4 text-base font-extrabold text-star-900">You have no investments yet</h3><p className="mt-2 max-w-sm text-sm leading-5 text-star-muted">Explore our investment solutions and start building your portfolio today.</p><a href="/services" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-900 px-4 text-sm font-bold text-white no-underline transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Explore Investment Products <ArrowRight size={16} aria-hidden="true" /></a></div>
    </section>
  );
}

export function EmptyTransactionsPanel() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="empty-transactions-heading">
      <div className="flex items-center justify-between gap-4"><h2 id="empty-transactions-heading" className="text-lg font-extrabold text-star-900">Recent Transactions</h2><a href="/transactions" className="inline-flex items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">View all <ArrowRight size={16} aria-hidden="true" /></a></div>
      <div className="flex min-h-[230px] flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-star-50 text-star-300" aria-hidden="true"><FileText size={31} /></span><h3 className="mt-4 text-base font-extrabold text-star-900">No transactions yet</h3><p className="mt-2 max-w-sm text-sm leading-5 text-star-muted">Your transactions will appear here once you start investing or make a deposit.</p></div>
    </section>
  );
}
