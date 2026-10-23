import { ArrowRight, BarChart3, Landmark, Percent, WalletCards } from "lucide-react";
import { marketEquities } from "./site-data";
import { SectionHeading } from "./ui";

const pulse = [
  { icon: Percent, label: "Inflation (Headline)", detail: "Latest published figure", value: "—" },
  { icon: Landmark, label: "Monetary Policy Rate", detail: "CBN policy rate", value: "—" },
  { icon: WalletCards, label: "Cash Reserve Ratio", detail: "Deposit money banks", value: "—" },
];

export function MarketOverview() {
  return (
    <section className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Market overview" title="Market at a glance" description="Key market indicators to keep you informed. Market data may be delayed." />
          <a href="#market-data-notice" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
            View more market data <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <article className="overflow-hidden rounded-2xl border border-star-200 bg-white">
            <div className="flex items-center gap-3 border-b border-star-200 px-5 py-4 sm:px-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-star-100 text-star-700"><BarChart3 size={19} aria-hidden="true" /></span>
              <div>
                <h3 className="font-display text-lg font-bold text-star-900">Selected NGX Equities</h3>
                <p className="text-xs text-star-muted">Illustrative placeholders</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[430px] text-left text-sm">
                <thead className="bg-star-50 text-[0.66rem] uppercase tracking-[0.1em] text-star-muted">
                  <tr><th className="px-5 py-3 font-bold sm:px-6">Company</th><th className="px-5 py-3 text-right font-bold">Price (₦)</th><th className="px-5 py-3 text-right font-bold sm:px-6">Change</th></tr>
                </thead>
                <tbody className="divide-y divide-star-100">
                  {marketEquities.map((company) => (
                    <tr key={company} className="transition hover:bg-star-50/60">
                      <td className="px-5 py-4 font-bold text-star-900 sm:px-6">{company}</td>
                      <td className="px-5 py-4 text-right text-star-muted">—</td>
                      <td className="px-5 py-4 text-right font-bold text-star-muted sm:px-6">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl bg-star-900 p-5 text-white sm:p-6">
            <h3 className="font-display text-xl font-bold text-white">Market Pulse</h3>
            <p className="mt-1 text-sm text-star-100">Core policy indicators, shown as placeholders.</p>
            <div className="mt-5 divide-y divide-white/15 rounded-xl border border-white/15 bg-white/5">
              {pulse.map(({ icon: Icon, label, detail, value }) => (
                <div key={label} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <Icon size={18} className="shrink-0 text-star-lime" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-white">{label}</p>
                      <p className="mt-0.5 text-xs text-star-200">{detail}</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-star-lime">{value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
