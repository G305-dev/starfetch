import { ChevronRight } from "lucide-react";
import { individualQuickActions } from "./individual-dashboard-data";

export function IndividualQuickActions() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5" aria-labelledby="individual-quick-actions-heading">
      <h2 id="individual-quick-actions-heading" className="text-lg font-extrabold text-star-900">Quick Actions</h2>
      <div className="mt-4 grid gap-2">
        {individualQuickActions.map(({ label, href, icon: Icon, primary }) => <a key={label} href={href} className={`group flex min-h-12 items-center gap-3 rounded-lg border px-3.5 text-sm font-bold no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 ${primary ? "border-star-900 bg-star-900 text-white hover:bg-star-700" : "border-star-200 bg-white text-star-700 hover:bg-star-50"}`}><span className={`grid h-8 w-8 place-items-center rounded-md ${primary ? "bg-white/10 text-star-lime" : "bg-star-50 text-star-700"}`} aria-hidden="true"><Icon size={17} /></span><span className="flex-1">{label}</span><ChevronRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></a>)}
      </div>
    </section>
  );
}
