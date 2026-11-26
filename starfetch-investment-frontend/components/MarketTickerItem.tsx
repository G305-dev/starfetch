import type { NgxQuote, QuoteValue } from "@/lib/market/types";

/**
 * Ticker cells for the homepage's scrolling equities strip.
 *
 * DESIGN (V4): white background, Starfetch dark green for the symbol and price,
 * and only the daily change carries colour — green for up, red for down.
 *
 * Contrast is the reason the symbol and price are `text-star-900` (#003B2A)
 * rather than the brand's mid-greens: on white that is roughly 12:1, well past
 * WCAG AAA for small text. The change tones are `emerald-700` / `red-700`
 * specifically, not the lighter `-300` shades the previous dark strip used —
 * `-300` on white is about 1.6:1 and would have been unreadable.
 */

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function changeClass(change: QuoteValue) {
  if (change === null) return "text-star-muted";
  if (change > 0) return "text-emerald-700";
  if (change < 0) return "text-red-700";
  return "text-star-muted";
}

function changeLabel(change: QuoteValue) {
  if (change === null) return "—";
  const prefix = change > 0 ? "+" : "";
  return `${prefix}${change.toFixed(2)}%`;
}

/**
 * Screen-reader wording so a colour is never the only signal.
 *
 * The visible cell shows an arrow as well, but an arrow is still purely visual;
 * this is the part that actually travels to assistive technology.
 */
function changeSrLabel(change: QuoteValue) {
  if (change === null) return "unavailable";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "unchanged";
}

/** A small direction glyph so the change is not conveyed by colour alone. */
function changeGlyph(change: QuoteValue) {
  if (change === null || change === 0) return null;
  return (
    <span aria-hidden="true" className="text-[0.5rem] leading-none">
      {change > 0 ? "▲" : "▼"}
    </span>
  );
}

export function NgxTickerCell({ quote, duplicate = false }: { quote: NgxQuote; duplicate?: boolean }) {
  const price = quote.priceNgn === null ? "Unavailable" : naira.format(quote.priceNgn);
  return (
    <li
      key={`${duplicate ? "copy-" : ""}${quote.symbol}`}
      className="flex h-[58px] min-w-[236px] shrink-0 items-center gap-3 border-r border-star-200 px-4 sm:min-w-[256px]"
    >
      <span className="shrink-0 rounded border border-star-700/30 bg-star-100 px-1.5 py-0.5 text-[0.53rem] font-extrabold uppercase tracking-[0.13em] text-star-800">
        NGX
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.7rem] font-extrabold tracking-wide text-star-900">{quote.symbol}</span>
        <span className="mt-0.5 block truncate text-[0.6rem] font-medium text-star-muted">{quote.companyName}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[0.67rem] font-extrabold tabular-nums text-star-900">{price}</span>
        <span className={`mt-0.5 flex items-center justify-end gap-0.5 text-[0.58rem] font-bold tabular-nums ${changeClass(quote.changePercent)}`}>
          <span className="sr-only">
            {quote.symbol} daily change {changeSrLabel(quote.changePercent)}{" "}
          </span>
          {changeGlyph(quote.changePercent)}
          {changeLabel(quote.changePercent)}
        </span>
      </span>
    </li>
  );
}
