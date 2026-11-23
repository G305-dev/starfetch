"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NgxQuote, QuoteValue } from "@/lib/market/types";

/**
 * The NGX price table for the Market at a Glance card.
 *
 * V1 rendered five rows and put a "View All NGX Stocks" link beside the heading
 * whose href was `#ngx-markets` — the id of the very section it sat in. Clicking
 * it scrolled nowhere and revealed nothing, while implying a complete listing was
 * available. This component replaces that with a real control:
 *
 *   - collapsed: the five most relevant rows, as before;
 *   - expanded: ALL 14 configured listings, in the same table.
 *
 * The separate link to the NGX's own listed-companies page is gone too: it was
 * the *only* thing that could have been called a complete listing, and it is
 * still offered from the card footer as an explicit external reference rather
 * than masquerading as in-page expansion.
 *
 * A client component is required for the toggle, but the initial server-rendered
 * markup is the collapsed state, so the card is fully rendered without JS.
 */

const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Rows shown while collapsed. */
const COLLAPSED_LIMIT = 5;

function formatNgn(value: QuoteValue) {
  return value === null ? "—" : naira.format(value);
}

function formatChange(value: QuoteValue) {
  if (value === null) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function changeTone(value: QuoteValue) {
  if (value === null) return "text-star-muted";
  if (value > 0) return "text-emerald-700";
  if (value < 0) return "text-red-700";
  return "text-star-muted";
}

function changeSrLabel(value: QuoteValue) {
  if (value === null) return "unavailable";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "unchanged";
}

export function NgxPriceTable({ markets }: { markets: readonly NgxQuote[] }) {
  const [expanded, setExpanded] = useState(false);
  const tableId = useId();

  /**
   * Quoted listings first, then the rest in directory order — otherwise the card
   * can show five unquoted rows while a real price sits further down the list,
   * which reads as a broken feed.
   */
  const ordered = [
    ...markets.filter((market) => market.priceNgn !== null),
    ...markets.filter((market) => market.priceNgn === null),
  ];
  const visible = expanded ? ordered : ordered.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = Math.max(ordered.length - visible.length, 0);

  return (
    <>
      {/* min-w-0 is required: without it this flex/grid child refuses to shrink
          below its content width, so the 430px table pushes the whole page wide
          instead of scrolling inside its own box. */}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left" id={tableId}>
          <thead>
            <tr className="bg-[#f8faf5] text-[0.62rem] font-extrabold uppercase tracking-[0.1em] text-star-muted">
              <th scope="col" className="w-[31%] px-1.5 py-3 sm:px-2">Symbol</th>
              <th scope="col" className="px-2 py-3 sm:px-3">Company</th>
              <th scope="col" className="w-[23%] px-1.5 py-3 text-right sm:px-2">Price (₦)</th>
              <th scope="col" className="w-[16%] px-1.5 py-3 text-right sm:px-2">Daily</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-star-100">
            {visible.map((market) => (
              <tr key={market.symbol} className="transition hover:bg-star-50/70">
                <th scope="row" className="whitespace-nowrap px-1.5 py-3 text-[0.6rem] font-extrabold tracking-tight text-star-700 sm:px-2">
                  <span className="rounded-md bg-star-50 px-1 py-1">{market.symbol}</span>
                </th>
                <td className="px-1.5 py-3 text-[0.72rem] font-semibold text-star-900 sm:px-2">
                  <span className="line-clamp-2">{market.companyName}</span>
                </td>
                <td className="whitespace-nowrap px-1.5 py-3 text-right text-[0.78rem] font-semibold tabular-nums text-star-900 sm:px-2">
                  {formatNgn(market.priceNgn)}
                </td>
                <td className={`whitespace-nowrap px-1.5 py-3 text-right text-[0.78rem] font-bold tabular-nums sm:px-2 ${changeTone(market.changePercent)}`}>
                  <span className="sr-only">{market.symbol} daily change {changeSrLabel(market.changePercent)} </span>
                  {formatChange(market.changePercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-star-100 px-5 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={tableId}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-star-700 no-underline underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
        >
          {expanded ? "Show fewer NGX stocks" : "View All NGX Stocks"}
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        <p className="text-[0.65rem] font-semibold text-star-muted" aria-live="polite">
          {expanded
            ? `Showing all ${ordered.length} listings`
            : `Showing ${visible.length} of ${ordered.length} listings${hiddenCount > 0 ? ` — ${hiddenCount} more` : ""}`}
        </p>
      </div>
    </>
  );
}
