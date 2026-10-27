import { ArrowRight } from "lucide-react";
import { latestUpdates } from "./individual-dashboard-data";

export function LatestUpdates() {
  return (
    <section id="notifications" className="scroll-mt-24 rounded-xl border border-star-200 bg-white p-5" aria-labelledby="latest-updates-heading">
      <div className="flex items-center justify-between gap-4"><h2 id="latest-updates-heading" className="text-lg font-extrabold text-star-900">Latest Updates</h2><a href="#notifications" className="inline-flex items-center gap-1 text-xs font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">View all <ArrowRight size={14} aria-hidden="true" /></a></div>
      <ul className="mt-4 divide-y divide-star-100">{latestUpdates.map(({ title, description, date, icon: Icon, unread }) => <li key={title} className="relative flex gap-3 py-4 first:pt-0 last:pb-0"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-star-50 text-star-700" aria-hidden="true"><Icon size={19} strokeWidth={1.9} /></span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-star-900">{title}</p><p className="mt-0.5 text-xs leading-5 text-star-muted">{description}</p><p className="mt-1 text-[0.68rem] text-star-muted">{date}</p></div>{unread ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-label="Unread update" /> : null}</li>)}</ul>
    </section>
  );
}
