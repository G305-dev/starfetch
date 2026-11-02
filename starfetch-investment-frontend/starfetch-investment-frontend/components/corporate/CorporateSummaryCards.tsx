import { corporateSummaryMetrics } from "./corporate-dashboard-data";

export function CorporateSummaryCards() {
  return (
    <section aria-label="Corporate account summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {corporateSummaryMetrics.map(({ label, value, icon: Icon, tone }) => <article key={label} className="rounded-lg border border-star-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-star-900">{label}</p><span className="grid h-11 w-11 place-items-center rounded-full bg-star-50 text-star-700" aria-hidden="true"><Icon size={21} strokeWidth={1.9} /></span></div><p className={`mt-5 text-[clamp(1.55rem,2.3vw,2rem)] font-extrabold leading-none tracking-[-0.045em] tabular-nums ${tone === "positive" ? "text-star-700" : "text-star-900"}`}>{value}</p></article>)}
    </section>
  );
}
