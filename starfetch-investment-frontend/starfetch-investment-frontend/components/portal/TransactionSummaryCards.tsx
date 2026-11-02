import { ArrowUp, Info } from "lucide-react";
import { transactionSummary } from "./transactions-data";

export function TransactionSummaryCards() {
  return (
    <section aria-label="Transaction summary" className="grid gap-4 lg:grid-cols-3">
      {transactionSummary.map(({ label, value, trend, context, icon: Icon, emphasis }) => (
        <article key={label} className={`rounded-xl border p-5 sm:p-6 ${emphasis ? "border-star-100 bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}>
          <div className="flex gap-4">
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${emphasis ? "bg-star-100 text-star-700" : "bg-star-50 text-star-700"}`}>
              <Icon size={27} strokeWidth={1.85} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-star-muted">{label}<Info size={15} aria-hidden="true" /></p>
              <p className="mt-3 whitespace-nowrap text-[clamp(1.45rem,2.25vw,2rem)] font-extrabold leading-none tracking-[-0.055em] tabular-nums text-star-900">{value}</p>
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"><span className="inline-flex items-center gap-1 font-extrabold text-[#22953d]"><ArrowUp size={17} strokeWidth={2.5} aria-hidden="true" />{trend}</span><span className="text-star-muted">{context}</span></p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
