import { BarChart3, CircleDollarSign, WalletCards } from "lucide-react";
import type { InvestorPortfolio } from "@/lib/api/client";
import { formatCurrencyMinor } from "./dashboard-formatters";

export function InvestmentSummaryCards({ portfolio }: { portfolio: InvestorPortfolio }) {
  const summary = [
    {
      label: "Total Portfolio Value",
      value: formatCurrencyMinor(portfolio.totalValueMinor, portfolio.currency),
      detail: portfolio.totalValueMinor === null ? "Not available yet" : "Stored holding value",
      icon: WalletCards,
      emphasis: true,
    },
    {
      label: "Total Holdings",
      value: portfolio.holdingCount === null ? "—" : String(portfolio.holdingCount),
      detail: portfolio.holdingCount === null ? "Not available yet" : "Reported portfolio holding count",
      icon: BarChart3,
      emphasis: false,
    },
    {
      label: "Total Returns",
      value: formatCurrencyMinor(portfolio.totalReturnMinor, portfolio.currency),
      detail: portfolio.totalReturnMinor === null ? "Not available yet" : "Approved portfolio return",
      icon: CircleDollarSign,
      emphasis: false,
    },
  ];

  return <section aria-label="Investment summary" className="grid gap-4 lg:grid-cols-3">{summary.map(({ label, value, detail, icon: Icon, emphasis }) => <article key={label} className={`rounded-xl border p-5 sm:p-6 ${emphasis ? "border-star-100 bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}><div className="flex gap-4"><span className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${emphasis ? "bg-star-100 text-star-700" : "bg-star-50 text-star-700"}`}><Icon size={27} strokeWidth={1.85} aria-hidden="true" /></span><div className="min-w-0"><p className="text-sm font-semibold text-star-muted">{label}</p><p className="mt-3 whitespace-nowrap text-[clamp(1.45rem,2.25vw,2rem)] font-extrabold leading-none tracking-[-0.055em] tabular-nums text-star-900">{value}</p><p className="mt-3 text-sm text-star-muted">{detail}</p></div></div></article>)}</section>;
}
