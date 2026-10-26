import { ArrowUp } from "lucide-react";
import { summaryMetrics } from "./dashboard-data";

export function DashboardSummaryCards() {
  return (
    <section aria-label="Portfolio summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaryMetrics.map(({ label, value, detail, positive, icon: Icon, emphasis }) => (
        <article
          key={label}
          className={`rounded-xl border p-5 ${
            emphasis
              ? "border-star-100 bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]"
              : "border-star-200 bg-white"
          }`}
        >
          <div className="flex gap-3.5">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${emphasis ? "bg-star-100 text-star-700" : "bg-star-50 text-star-700"}`}>
              <Icon size={24} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-star-muted">{label}</p>
              <p className="mt-2 whitespace-nowrap text-[clamp(1.15rem,1.45vw,1.5rem)] font-extrabold leading-none tracking-[-0.05em] tabular-nums text-star-900">{value}</p>
              <p className={`mt-2 flex items-center gap-1 text-xs font-bold ${positive ? "text-[#22953d]" : "text-star-muted"}`}>
                {positive ? <ArrowUp size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
                <span>{detail}</span>
              </p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
