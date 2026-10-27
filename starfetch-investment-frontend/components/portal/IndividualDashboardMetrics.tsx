import { ArrowUp } from "lucide-react";
import { individualDashboardMetrics } from "./individual-dashboard-data";

export function IndividualDashboardMetrics() {
  return (
    <section aria-label="New investor account summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {individualDashboardMetrics.map(({ label, value, detail, icon: Icon, emphasis }) => (
        <article key={label} className={`rounded-xl border p-4 sm:p-5 ${emphasis ? "border-star-100 bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-star-900">{label}</p><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${emphasis ? "bg-star-100 text-star-700" : "bg-star-50 text-star-700"}`}><Icon size={21} strokeWidth={1.9} aria-hidden="true" /></span></div>
          <p className="mt-4 text-[clamp(1.6rem,2.45vw,2.25rem)] font-extrabold leading-none tracking-[-0.055em] tabular-nums text-star-900">{value}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-star-muted">{detail.includes("0%") ? <ArrowUp size={14} className="text-[#22953d]" aria-hidden="true" /> : <span className="h-3.5 w-3.5" aria-hidden="true" />}<span>{detail}</span></p>
        </article>
      ))}
    </section>
  );
}
