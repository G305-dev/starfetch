import { BarChart3 } from "lucide-react";
import { featuredNgxEquities, type NgxEquityListing } from "./ngx-market-directory";

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(value: number | null) {
  return value === null ? "Quote pending" : naira.format(value);
}

function formatChange(value: number | null) {
  if (value === null) return "Daily change pending";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function MarketItems({ markets, duplicate = false }: { markets: readonly NgxEquityListing[]; duplicate?: boolean }) {
  return (
    <ul className="ngx-market-slider-group" aria-hidden={duplicate || undefined}>
      {markets.map((market) => (
        <li key={`${duplicate ? "copy-" : ""}${market.symbol}`} className="flex h-[58px] min-w-[230px] shrink-0 items-center gap-3 border-r border-star-200 px-4 sm:min-w-[250px]">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-star-100 text-star-700"><BarChart3 size={15} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.7rem] font-extrabold tracking-wide text-star-900">{market.symbol}</span>
            <span className="mt-0.5 block truncate text-[0.6rem] font-medium text-star-muted">{market.companyName}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[0.67rem] font-extrabold tabular-nums text-star-900">{formatPrice(market.lastPriceNgn)}</span>
            <span className={`mt-0.5 block text-[0.58rem] font-bold tabular-nums ${market.dailyChangePercent === null ? "text-star-muted" : market.dailyChangePercent > 0 ? "text-emerald-700" : market.dailyChangePercent < 0 ? "text-red-700" : "text-star-muted"}`}>{formatChange(market.dailyChangePercent)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** NGX ticker strip below the navbar; its display model accepts backend-supplied prices later. */
export function NgxMarketTicker({ markets = featuredNgxEquities }: { markets?: readonly NgxEquityListing[] }) {
  return (
    <section aria-label="Nigerian Exchange market ticker" className="ngx-market-strip relative z-0 w-full overflow-hidden border-b border-star-200 bg-white">
      <div className="flex min-h-[58px] w-full">
        <div className="z-10 flex w-[128px] shrink-0 flex-col justify-center bg-star-900 px-3 text-white shadow-[5px_0_12px_rgba(0,59,42,0.08)] sm:w-[172px] sm:px-5">
          <span className="text-[0.58rem] font-extrabold uppercase tracking-[0.15em] text-star-lime">NGX market</span>
          <span className="mt-0.5 text-[0.6rem] font-semibold text-star-100">{markets.some((market) => market.lastPriceNgn !== null || market.dailyChangePercent !== null) ? "Backend data" : "Quote feed pending"}</span>
        </div>
        <div className="ngx-market-slider-viewport min-w-0 flex-1" aria-live="off">
          {markets.length ? (
            <div className="ngx-market-slider-track">
              <MarketItems markets={markets} />
              <MarketItems markets={markets} duplicate />
            </div>
          ) : (
            <div className="flex h-[58px] items-center px-5 text-sm font-semibold text-star-muted">NGX listings will appear here when supplied by the backend.</div>
          )}
        </div>
      </div>
      <p className="sr-only">This moving list shows NGX-listed equities. Quote values are provided by the backend and may be pending.</p>
    </section>
  );
}
