import { ArrowRight, BarChart3, Landmark, Percent, WalletCards } from "lucide-react";
import { TradingViewWidget } from "./TradingViewWidget";
import { SectionHeading } from "./ui";

const marketOverviewConfiguration = {
  colorTheme: "light",
  dateRange: "12M",
  height: "100%",
  isTransparent: true,
  largeChartUrl: "",
  locale: "en",
  showChart: false,
  showFloatingTooltip: false,
  showSymbolLogo: true,
  width: "100%",
  tabs: [
    {
      originalTitle: "Indices",
      symbols: [
        { d: "S&P 500", s: "FOREXCOM:SPXUSD" },
        { d: "NASDAQ 100", s: "FOREXCOM:NSXUSD" },
        { d: "Dow Jones", s: "FOREXCOM:DJI" },
        { d: "EUR/USD", s: "FX:EURUSD" },
        { d: "Gold", s: "TVC:GOLD" },
        { d: "Bitcoin", s: "BITSTAMP:BTCUSD" },
        { d: "Ethereum", s: "BITSTAMP:ETHUSD" },
      ],
      title: "Global markets",
    },
  ],
};

const pulse = [
  { icon: Percent, label: "Inflation (Headline)", detail: "Official source integration pending", value: "Pending" },
  { icon: Landmark, label: "Monetary Policy Rate", detail: "Official CBN source integration pending", value: "Pending" },
  { icon: WalletCards, label: "Cash Reserve Ratio", detail: "Official CBN source integration pending", value: "Pending" },
];

export function MarketOverview() {
  return (
    <section className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Market overview" title="Market at a glance" description="Global market data supplied through TradingView. Data availability and delays vary by instrument." />
          <a href="#market-data-notice" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
            Market data notice <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <article className="overflow-hidden rounded-2xl border border-star-200 bg-white">
            <div className="flex items-center gap-3 border-b border-star-200 px-5 py-4 sm:px-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-star-100 text-star-700"><BarChart3 size={19} aria-hidden="true" /></span>
              <div>
                <h3 className="font-display text-lg font-bold text-star-900">Supported global markets</h3>
                <p className="text-xs leading-5 text-star-muted">TradingView&apos;s free embeddable market list does not currently include Nigerian Exchange (NGX) equities, so this panel does not show or label global data as NGX prices.</p>
              </div>
            </div>
            <div className="h-[500px] p-2 sm:p-3">
              <TradingViewWidget
                ariaLabel="TradingView global market overview"
                className="h-full w-full"
                configuration={marketOverviewConfiguration}
                scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
              />
            </div>
          </article>

          <article className="rounded-2xl bg-star-900 p-5 text-white sm:p-6">
            <h3 className="font-display text-xl font-bold text-white">Market Pulse</h3>
            <p className="mt-1 text-sm text-star-100">Policy and statistical indicators remain pending until an approved official source is integrated.</p>
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
                  <span className="text-sm font-bold text-star-lime">{value}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
