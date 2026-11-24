import type { CommodityQuote, NgxQuote, QuoteValue } from "@/lib/market/types";

/**
 * The two cell kinds that share ONE scrolling track.
 *
 * Both use identical dimensions and spacing so the duplicate pass (needed for a
 * seamless loop) measures exactly 50% of the track, whichever cells are present.
 */

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function changeClass(change: QuoteValue) {
  if (change === null) return "text-star-200";
  if (change > 0) return "text-emerald-300";
  if (change < 0) return "text-red-300";
  return "text-star-100";
}

function changeLabel(change: QuoteValue) {
  if (change === null) return "—";
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${change.toFixed(2)}%`;
}

/** Screen-reader wording so a colour is never the only signal. */
function changeSrLabel(change: QuoteValue) {
  if (change === null) return "unavailable";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "unchanged";
}

export function NgxTickerCell({ quote, duplicate = false }: { quote: NgxQuote; duplicate?: boolean }) {
  const price = quote.priceNgn === null ? "Unavailable" : naira.format(quote.priceNgn);
  return (
    <li
      key={`${duplicate ? "copy-" : ""}${quote.symbol}`}
      className="flex h-[58px] min-w-[236px] shrink-0 items-center gap-3 border-r border-white/10 px-4 sm:min-w-[256px]"
    >
      <span className="shrink-0 rounded border border-star-lime/45 bg-star-lime/10 px-1.5 py-0.5 text-[0.53rem] font-extrabold uppercase tracking-[0.13em] text-star-lime">
        NGX
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.7rem] font-extrabold tracking-wide text-white">{quote.symbol}</span>
        <span className="mt-0.5 block truncate text-[0.6rem] font-medium text-star-200">{quote.companyName}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.67rem] font-extrabold tabular-nums text-white">{price}</span>
        <span className={`mt-0.5 block text-[0.58rem] font-bold tabular-nums ${changeClass(quote.changePercent)}`}>
          <span className="sr-only">{quote.symbol} daily change {changeSrLabel(quote.changePercent)} </span>
          {changeLabel(quote.changePercent)}
        </span>
      </span>
    </li>
  );
}

export function CommodityTickerCell({ quote, duplicate = false }: { quote: CommodityQuote; duplicate?: boolean }) {
  const price = quote.priceUsd === null ? "Unavailable" : usd.format(quote.priceUsd);
  return (
    <li
      key={`${duplicate ? "copy-" : ""}commodity-${quote.id}`}
      className="flex h-[58px] min-w-[250px] shrink-0 items-center gap-3 border-r border-[#d9b45a]/25 bg-[#d9b45a]/[0.06] px-4 sm:min-w-[268px]"
    >
      <span className="shrink-0 rounded border border-[#e8c979]/60 bg-[#e8c979]/15 px-1.5 py-0.5 text-[0.53rem] font-extrabold uppercase tracking-[0.13em] text-[#f0d79a]">
        Commodity
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.7rem] font-extrabold tracking-wide text-white">{quote.name}</span>
        <span className="mt-0.5 block truncate text-[0.6rem] font-medium text-star-200">
          {quote.symbol} · {quote.unitLabel}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.67rem] font-extrabold tabular-nums text-white">{price}</span>
        <span className={`mt-0.5 block text-[0.58rem] font-bold tabular-nums ${changeClass(quote.changePercent)}`}>
          <span className="sr-only">{quote.name} daily change {changeSrLabel(quote.changePercent)} </span>
          {changeLabel(quote.changePercent)}
        </span>
      </span>
    </li>
  );
}
