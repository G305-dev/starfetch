import { ChevronRight } from "lucide-react";
import { individualQuickActions } from "./individual-dashboard-data";

export function IndividualQuickActions() {
  return (
    <section className="rounded-xl border border-star-200 bg-white p-5" aria-labelledby="individual-quick-actions-heading">
      <div><h2 id="individual-quick-actions-heading" className="text-lg font-extrabold text-star-900">Quick Links</h2><p className="mt-1 text-sm text-star-muted">Choose an action to manage your account.</p></div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {individualQuickActions.map(({ label, href, icon: Icon, primary }) => <a key={label} href={href} className={`group flex min-h-[108px] flex-col justify-between rounded-xl border p-3.5 text-sm font-extrabold no-underline transition hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 ${primary ? "border-star-700 bg-star-700 text-white hover:bg-star-800" : "border-star-200 bg-white text-star-700 hover:bg-star-50"}`}><span className={`grid size-9 place-items-center rounded-lg ${primary ? "bg-white/10 text-star-lime" : "bg-star-50 text-star-700"}`} aria-hidden="true"><Icon size={18} /></span><span className="flex items-end justify-between gap-1 leading-5"><span>{label}</span><ChevronRight size={16} aria-hidden="true" className="mb-0.5 shrink-0 transition-transform group-hover:translate-x-0.5" /></span></a>)}
      </div>
    </section>
  );
}
