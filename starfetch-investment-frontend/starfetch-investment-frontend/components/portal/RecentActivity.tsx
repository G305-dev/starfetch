import { ArrowRight } from "lucide-react";
import { recentActivity } from "./transactions-data";

export function RecentActivity() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5 sm:p-6" aria-labelledby="recent-activity-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="recent-activity-heading" className="text-lg font-extrabold text-star-900">Recent Activity</h2>
        <a href="#transaction-history" className="inline-flex items-center gap-1 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">View All <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
      <ul className="mt-4 divide-y divide-star-100" aria-label="Recent sample transaction activity">
        {recentActivity.map(({ id, type, product, date, amount, icon: Icon }) => (
          <li key={id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-star-50 text-star-700" aria-hidden="true"><Icon size={18} strokeWidth={2.1} /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-star-900">{type}</p><p className="mt-0.5 truncate text-xs text-star-muted">{product} · {date}</p></div>
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-[#16842F]">{amount}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
