import { BarChart3, CircleDollarSign, WalletCards } from "lucide-react";
import type { InvestorPortfolio } from "@/lib/api/client";
import { formatCurrencyMinor } from "./dashboard-formatters";

export function IndividualDashboardMetrics({ portfolio }: { portfolio: InvestorPortfolio }) {
  const metrics = [
    { label: "Total Portfolio Value", value: formatCurrencyMinor(portfolio.totalValueMinor, portfolio.currency), detail: portfolio.totalValueMinor === null ? "Not available yet" : "Current portfolio value", icon: WalletCards, emphasis: true },
    { label: "Holdings", value: portfolio.holdingCount === null ? "—" : String(portfolio.holdingCount), detail: portfolio.holdingCount === null ? "Not available yet" : portfolio.holdingCount === 1 ? "Investment holding" : "Investment holdings", icon: BarChart3, emphasis: false },
    { label: "Total Return", value: formatCurrencyMinor(portfolio.totalReturnMinor, portfolio.currency), detail: portfolio.totalReturnMinor === null ? "Not available yet" : "Reported portfolio return", icon: CircleDollarSign, emphasis: false },
  ];

  return <section aria-label="Portfolio summary" className="grid gap-4 sm:grid-cols-3">{metrics.map(({ label, value, detail, icon: Icon, emphasis }) => <article key={label} className={`rounded-xl border p-4 sm:p-5 ${emphasis ? "border-star-100 bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-star-900">{label}</p><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${emphasis ? "bg-star-100 text-star-700" : "bg-star-50 text-star-700"}`}><Icon size={21} strokeWidth={1.9} aria-hidden="true" /></span></div><p className="mt-4 text-[clamp(1.6rem,2.45vw,2.25rem)] font-extrabold leading-none tracking-[-0.055em] tabular-nums text-star-900">{value}</p><p className="mt-3 text-xs text-star-muted">{detail}</p></article>)}</section>;
}
