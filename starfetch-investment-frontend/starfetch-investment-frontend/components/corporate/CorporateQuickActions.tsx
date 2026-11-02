import { ChevronRight } from "lucide-react";
import { corporateQuickActions } from "./corporate-dashboard-data";

export function CorporateQuickActions() {
  return (
    <section className="rounded-lg border border-star-200 bg-white p-5" aria-labelledby="corporate-quick-actions-heading">
      <h2 id="corporate-quick-actions-heading" className="text-lg font-extrabold text-star-900">Quick Actions</h2>
      <div className="mt-4 grid gap-3">{corporateQuickActions.map(({ label, href, icon: Icon, primary }) => <a key={label} href={href} className={`group flex min-h-12 items-center gap-3 rounded-md border px-3.5 text-sm font-bold no-underline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 ${primary ? "border-star-900 bg-star-900 text-white hover:bg-star-700" : "border-star-200 bg-white text-star-700 hover:bg-star-50"}`}><Icon size={19} aria-hidden="true" /><span className="flex-1">{label}</span><ChevronRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></a>)}</div>
    </section>
  );
}
