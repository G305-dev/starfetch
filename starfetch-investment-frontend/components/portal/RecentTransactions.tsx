import { ArrowRight } from "lucide-react";
import { recentTransactions, transactionIcons } from "./dashboard-data";

export function RecentTransactions() {
  return (
    <section id="recent-transactions" className="scroll-mt-24 rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="recent-transactions-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-transactions-heading" className="text-lg font-extrabold text-star-900">Recent Transactions</h2>
        <a href="/dashboard#recent-transactions" className="inline-flex items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
          View All <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
      <ul className="mt-4 divide-y divide-star-100" aria-label="Sample recent transactions">
        {recentTransactions.map(({ title, timestamp, amount, type }) => {
          const Icon = transactionIcons[type];
          return (
            <li key={`${title}-${timestamp}`} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-star-50 text-[#22953d]" aria-hidden="true">
                <Icon size={19} strokeWidth={2.1} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-star-900">{title}</p>
                <p className="mt-0.5 text-xs text-star-muted">{timestamp}</p>
              </div>
              <p className="shrink-0 text-sm font-extrabold text-[#16842F]">{amount}</p>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-xs text-star-muted">Transactions shown are illustrative sample data only.</p>
    </section>
  );
}
