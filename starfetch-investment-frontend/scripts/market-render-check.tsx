/**
 * MARKET RENDER — RUNTIME test of the REAL homepage market components.
 *
 * Provenance: `[REAL component]`. `NgxMarketTicker` and `MarketOverview` are the
 * shipped files, rendered with `react-dom/server` against controlled props. No
 * network, no database.
 *
 * This covers the states the brief insists on: loading-adjacent empty data,
 * unavailable, stale, delayed and a healthy feed — plus the single-track
 * structure and the V4 colour contract that can only be verified from rendered
 * markup.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NgxMarketTicker } from "../components/NgxMarketTicker";
import { NgxPriceTable } from "../components/NgxPriceTable";
import { MarketOverviewSkeleton } from "../components/MarketOverviewSkeleton";
import { MarketTickerSkeleton } from "../components/MarketTickerSkeleton";
import { withholdIfUnavailable } from "../lib/market/withhold";
import { MarketOverview } from "../components/MarketOverview";
import { featuredNgxEquities } from "../components/ngx-market-directory";
import { mergeNgxQuotes, parseNgxSnapshot } from "../lib/market/market-snapshot-adapter";
import type { MarketPulseResult } from "../lib/market/market-pulse";
import type { FeedStatus, NgxQuote } from "../lib/market/types";

const UNAVAILABLE: FeedStatus = {
  state: "unavailable",
  asOf: null,
  asOfLabel: "",
  source: null,
  note: "NGX quotations are waiting for the backend market-data service to be connected.",
};

const NOW = new Date("2026-11-17T12:00:00.000Z").getTime();

const liveNgx: NgxQuote[] = mergeNgxQuotes(
  featuredNgxEquities,
  parseNgxSnapshot(
    {
      asOf: "2026-11-17T11:55:00.000Z",
      source: "NGN Market",
      quotations: [
        { symbol: "DANGCEM", companyName: "Dangote Cement Plc", lastPrice: 1323, changePercent: -9.99 },
        { symbol: "GTCO", companyName: "Guaranty Trust Holding Company Plc", lastPrice: 117, changePercent: 0.68 },
      ],
    },
    NOW,
  ).quotes,
);

const readyPulse: MarketPulseResult = {
  status: "ready",
  data: {
    indicators: [
      { id: "headline-inflation", label: "Headline Inflation", value: 14.06, unit: "%", reportingPeriod: "October 2026", previousValue: 14.63, previousPeriod: "September 2026", appliesTo: null, note: "Fifth consecutive decline.", source: "National Bureau of Statistics (NBS)", sourceUrl: "https://nigerianstat.gov.ng/", lastVerified: "2026-11-17" },
      { id: "monetary-policy-rate", label: "Monetary Policy Rate", value: 23, unit: "%", reportingPeriod: "September 2026 MPC", previousValue: 26.5, previousPeriod: "July 2026 MPC", appliesTo: null, note: "Cut 350bp.", source: "Central Bank of Nigeria (CBN)", sourceUrl: "https://www.cbn.gov.ng/", lastVerified: "2026-11-17" },
      { id: "cash-reserve-ratio", label: "Cash Reserve Ratio", value: 45, unit: "%", reportingPeriod: "September 2026 MPC", previousValue: 45, previousPeriod: "July 2026 MPC", appliesTo: "Deposit Money Banks", note: "Unchanged.", source: "Central Bank of Nigeria (CBN)", sourceUrl: "https://www.cbn.gov.ng/", lastVerified: "2026-11-17" },
    ],
    lastVerified: "2026-11-17",
    updateProcess: "",
    disclaimer: "",
  },
};

const LIVE: FeedStatus = {
  state: "live",
  asOf: "2026-11-17T11:55:00.000Z",
  asOfLabel: "17 Nov 2026, 12:55 WAT",
  source: "NGN Market",
};

const unavailablePulse: MarketPulseResult = { status: "unavailable", note: "Market Pulse is temporarily unavailable while its data file is being updated." };

function failures(): string[] {
  const problems: string[] = [];
  const check = (condition: boolean, message: string) => { if (!condition) problems.push(message); };
  const tickerHtml = (markets: NgxQuote[], ngxStatus: FeedStatus) =>
    renderToStaticMarkup(createElement(NgxMarketTicker as never, { markets, ngxStatus }));
  const overviewHtml = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(MarketOverview as never, props));

  // --- 1. ONE continuous track of equities --------------------------------
  {
    const html = tickerHtml(liveNgx, LIVE);
    const trackCount = (html.match(/ngx-market-slider-track/g) ?? []).length;
    check(trackCount === 1, `Exactly one scrolling track must exist (found ${trackCount})`);
    const lists = html.split("ngx-market-slider-group").length - 1;
    check(lists === 2, `The single track must contain exactly two identical passes (found ${lists})`);
    const firstPass = html.slice(html.indexOf("ngx-market-slider-group"), html.indexOf("ngx-market-slider-group", html.indexOf("ngx-market-slider-group") + 1));
    check(firstPass.includes("DANGCEM") && firstPass.includes("GTCO"), "The FIRST pass must contain the equity cells");
    const sectionCount = (html.match(/aria-label="Nigerian and international stock market ticker"/g) ?? []).length;
    check(sectionCount === 1, "There must be exactly one market strip section");
    // The duplicate pass is the mechanism the -50% keyframe depends on.
    check(firstPass.split("<li").length === html.slice(html.lastIndexOf("ngx-market-slider-group")).split("<li").length, "Both passes must render the identical cell sequence");
  }

  // --- 2. V4 COLOUR CONTRACT: white strip, dark-green text ---------------
  {
    const html = tickerHtml(liveNgx, LIVE);
    // The strip background is white.
    const sectionTag = html.slice(0, html.indexOf(">", html.indexOf("<section")));
    check(/\bbg-white\b/.test(sectionTag), "The strip background must be white (#FFFFFF)");
    check(!/\bbg-star-900\b/.test(sectionTag), "The strip must no longer use the dark-green background");
    // The scrolling viewport is white too, not just the outer section.
    check(/ngx-market-slider-viewport[^"]*bg-white/.test(html), "The scrolling viewport must be white");
    // Symbols and prices are dark green.
    check(/text-star-900[^"]*">[A-Z]{3,}/.test(html) || /class="block truncate text-\[0\.7rem\] font-extrabold tracking-wide text-star-900"/.test(html),
      "Stock symbols must render in the dark-green brand colour");
    check(/₦1,323\.00/.test(html), "A live NGX price must render as naira");
    const priceSpan = html.slice(html.indexOf("₦1,323.00") - 260, html.indexOf("₦1,323.00"));
    check(/text-star-900/.test(priceSpan), "The price must carry the dark-green colour, not white");
    // No white text anywhere in a cell — it would be invisible on white.
    const cellMarkup = html.slice(html.indexOf("ngx-market-slider-track"));
    check(!/text-white/.test(cellMarkup), "No ticker cell may use white text on the white background");
  }

  // --- 3. Change colours: green up, red down, and not by colour alone ----
  {
    const html = tickerHtml(liveNgx, LIVE);
    check(html.includes("-9.99%"), "A negative change must render with a minus sign");
    check(html.includes("+0.68%"), "A positive change must render with a plus sign");
    check(/text-emerald-700/.test(html), "Positive changes must use the green tone");
    check(/text-red-700/.test(html), "Negative changes must use the red tone");
    // The dark-strip shades fail contrast on white (~1.6:1), so they must be gone.
    check(!/text-emerald-300/.test(html), "The pale emerald from the dark strip must not survive the white redesign");
    check(!/text-red-300/.test(html), "The pale red from the dark strip must not survive the white redesign");
    check(html.includes("down") && html.includes("up"), "The direction must reach screen readers, not only the eye");
    check(html.includes("▲") && html.includes("▼"), "A direction glyph must accompany the colour so colour is not the only signal");
  }

  // --- 3b. V5: the fixed marker block is REMOVED, leaving no residue ------
  {
    const html = tickerHtml(liveNgx, LIVE);
    // The container itself, not merely its colour.
    check(!/NGX\s*·\s*Stocks/i.test(html), "the NGX · Stocks container must not render");
    check(!/bg-star-900/.test(html), "the dark-green container must not render");
    // Its layout side-effects must be gone too: fixed width, z-index, shadow.
    check(!/w-\[124px\]|w-\[190px\]|sm:w-\[190px\]/.test(html), "the marker's fixed widths must be gone");
    check(!/z-10/.test(html), "the marker's z-10 stacking must be gone");
    check(!/shadow-\[5px_0_12px/.test(html), "the marker's directional shadow must be gone");
    // The track is now the first and only child, spanning the full width.
    check(/ngx-market-slider-viewport[^"]*\bw-full\b/.test(html), "the viewport must span the full width");
    check(!/flex min-h-\[58px\] w-full/.test(html), "the flex wrapper that held the marker and the track must be gone");
    // One track, two passes — the animation contract is untouched.
    check((html.match(/ngx-market-slider-track/g) ?? []).length === 1, "there must still be exactly one track");
    check((html.match(/ngx-market-slider-group/g) ?? []).length === 2, "the two-pass loop must be unchanged");
    // The cells and the white surface survive.
    check(/bg-white/.test(html), "the strip must stay white");
    check(html.includes("ACCESSCORP"), "the stock cells must still render");
    check(!/Commodit/i.test(html), "no commodity cell may reappear");
  }

  // --- 4. No commodity content anywhere in the rendered strip ------------
  {
    const html = tickerHtml(liveNgx, LIVE);
    check(!/Commodit/i.test(html), "The strip must render no commodity content");
    check(!/Cmdty/.test(html), "The per-commodity-feed label must be gone from the marker");
    check(!/Gold|Silver|Brent|Cocoa/.test(html), "No commodity instrument may appear in the strip");
    check(!/\$4,219/.test(html), "No commodity price may be rendered");
    check(!/data-commodity-state/.test(html), "The commodity availability attribute must be gone");
    // V5: the fixed marker block is removed outright.
    check(!html.includes("NGX · Stocks") && !/NGX\s*·\s*STOCKS/i.test(html), "The NGX · Stocks marker must be gone, not recoloured");
    check(!/bg-star-900/.test(html), "The dark-green marker block must not render anywhere in the strip");
  }

  // --- 5. Unavailable state (the current production state) ---------------
  {
    const html = tickerHtml(mergeNgxQuotes(featuredNgxEquities, new Map()), UNAVAILABLE);
    check(html.includes('data-ngx-state="unavailable"'), "The strip must expose the NGX availability state");
    // The badge is gone, so the state must still be stated for assistive tech.
    check(/N\/A|Unavailable/.test(html), "An unavailable feed must still read as unavailable in the sr-only summary");
    check(!/₦\d/.test(html), "No naira price may be rendered when no quote exists");
    check((html.match(/Unavailable/g) ?? []).length >= 14, "Every equity cell must show an explicit unavailable value");
    check(html.includes("ZENITHBANK"), "All 14 listings must still be listed while unquoted");
  }

  // --- 6. Stale state ----------------------------------------------------
  {
    const stale: FeedStatus = { state: "stale", asOf: "2026-11-17T09:00:00.000Z", asOfLabel: "17 Nov 2026, 10:00 WAT", source: "NGN Market", note: "Showing the last quotation the provider returned; newer prices are not available yet." };
    const html = overviewHtml({ markets: liveNgx, ngxStatus: stale, pulse: readyPulse });
    check(html.includes('data-feed-state="stale"'), "A stale feed must be labelled in the markup");
    check(html.includes("As of 17 Nov 2026, 10:00 WAT"), "A stale quote must show its genuine timestamp");
    check(html.includes("last quotation the provider returned"), "A stale quote must explain that it is the last known value");
    check(/₦[\d,]+\.\d{2}/.test(html), "A stale quote still shows the last real value rather than blanking it");
  }

  // --- 7. Delayed state --------------------------------------------------
  {
    const delayed: FeedStatus = { state: "delayed", asOf: "2026-11-17T11:55:00.000Z", asOfLabel: "17 Nov 2026, 12:55 WAT", source: "NGN Market", note: "The provider marks these quotes as delayed." };
    const html = overviewHtml({ markets: liveNgx, ngxStatus: delayed, pulse: readyPulse });
    check(html.includes('data-feed-state="delayed"'), "A delayed feed must be labelled in the markup");
    check(html.includes("delayed"), "The delayed label must reach the visitor");
  }

  // --- 8. Market at a Glance: ONE full-width card + Market Pulse ---------
  {
    const html = overviewHtml({ markets: liveNgx, ngxStatus: UNAVAILABLE, pulse: readyPulse });
    check(html.includes("NGX Stocks"), "The NGX card must be present");
    check(!/Commodit/i.test(html), "The commodities card must be gone");
    check(!html.includes("Symbols and pricing units"), "The commodity provenance disclosure must be gone");
    check(!/USD per troy ounce|USD per barrel|USD per metric ton/.test(html), "No commodity unit wording may remain");
    // No empty container: the old two-column grid would leave a blank half.
    check(!/lg:grid-cols-2/.test(html), "The two-card grid must be gone so no empty half-column is left behind");
    check(html.includes("Market Pulse") && html.includes("The numbers shaping Nigerian investing"), "The separate Market Pulse section must still be present");
    check((html.match(/<article/g) ?? []).length === 4, `One quote card plus three Market Pulse cards must render (found ${(html.match(/<article/g) ?? []).length})`);
    check(html.includes("Price (₦)") && html.includes("Daily"), "The NGX table must show its price and change columns");
    check(html.includes("View All NGX Stocks"), "The View All NGX Stocks control must remain");
    check(html.includes("14.06%") && html.includes("23%") && html.includes("45%"), "All three Market Pulse figures must render");
    check(html.includes("Deposit Money Banks"), "The CRR row must state its scope");
    check(html.includes("October 2026"), "Market Pulse must show the inflation reporting period");
    check(html.includes("not live or real-time data"), "Market Pulse must state it is not live data");
    check(!html.includes("All-Share") && !html.includes("market capitalisation"), "Market Pulse must not contain ASI or market cap");
    const tickerText = tickerHtml(liveNgx, LIVE);
    check(tickerText.includes("ZENITHBANK"), "The ticker must carry the full 14-listing directory");
  }

  // --- 9. Market Pulse unavailable ---------------------------------------
  {
    const html = overviewHtml({ markets: liveNgx, ngxStatus: UNAVAILABLE, pulse: unavailablePulse });
    check(html.includes("Indicators temporarily unavailable"), "An unavailable Market Pulse must say so plainly");
    check(!html.includes("14.06%"), "No stale indicator value may be rendered when the file is unavailable");
    check(!/(14\.06|26\.5|45)%/.test(html) && !/>\s*23%\s*</.test(html), "No indicator percentage may be rendered when the Market Pulse file is unavailable");
  }

  // --- 10. NGX card with no feed -----------------------------------------
  {
    const html = overviewHtml({ markets: mergeNgxQuotes(featuredNgxEquities, new Map()), ngxStatus: UNAVAILABLE, pulse: readyPulse });
    check(html.includes('data-feed-state="unavailable"'), "The NGX card must expose the unavailable state");
    check(!/₦[\d,]+\.\d{2}/.test(html), "No price may be rendered without a quote");
    check(!/\$\d/.test(html), "No dollar figure may appear anywhere now that commodities are gone");
    // The card shows only the first 5 rows, so assert on the directory head.
    check(html.includes("ACCESSCORP"), "The listings must still be named while unquoted");
  }

  // --- 11. Defaults fail closed -----------------------------------------
  {
    const html = overviewHtml({});
    check(html.includes("Market Pulse"), "The section must still render with no props at all");
    check(!/₦\d/.test(html), "No price may appear when no data is supplied");
    check(!/\d+\.\d+%/.test(html), "No percentage may appear when no data is supplied");
  }

  // --- 12. The feed reports itself honestly, per state -------------------
  {
    check(tickerHtml(liveNgx, LIVE).includes('data-ngx-state="live"'), "A live feed must report live");
    check(tickerHtml(liveNgx, LIVE).includes("Live · NGN Market"), "The live source label must render");
    const ngxStale = { state: "stale" as const, asOf: "2026-11-17T09:00:00.000Z", asOfLabel: "17 Nov 2026, 10:00 WAT", source: "NGN Market" };
    check(tickerHtml(liveNgx, ngxStale).includes("Stale"), "A stale NGX feed must be labelled stale");
    const none = tickerHtml(mergeNgxQuotes(featuredNgxEquities, new Map()), UNAVAILABLE);
    check(!/data-commodity-state/.test(none), "No commodity state attribute may survive");
  }

  // --- 13. "View All NGX Stocks" is a real control ----------------------
  {
    const collapsed = renderToStaticMarkup(createElement(NgxPriceTable as never, { markets: liveNgx }));
    check(collapsed.includes("View All NGX Stocks"), "The control text must be preserved");
    check(collapsed.includes("<button"), "It must be a real control, not an anchor");
    check(!collapsed.includes('href="#ngx-markets"'), "It must not be the misleading self-link");
    check(collapsed.includes('aria-expanded="false"'), "The control must expose its collapsed state");
    const collapsedRows = (collapsed.match(/<tr class="transition/g) ?? []).length;
    check(collapsedRows === 5, `The collapsed table must show 5 rows (found ${collapsedRows})`);
    check(collapsed.includes("5 of 14"), "The collapsed state must say how many of the listings are shown");
    check(collapsed.includes("9 more"), "The collapsed state must say how many remain hidden");
    check(liveNgx.length === 14, "The table must be given all 14 listings, so expanding can reveal them all");
  }

  // --- 14. Loading skeletons match the NEW geometry ---------------------
  {
    const overviewSkeleton = renderToStaticMarkup(createElement(MarketOverviewSkeleton));
    check(overviewSkeleton.includes('aria-busy="true"'), "The skeleton must be marked busy for assistive tech");
    check(overviewSkeleton.includes("Loading market data"), "The skeleton must announce loading to screen readers");
    // V4: ONE quote card, not two. A second placeholder would recreate the gap.
    check(!/lg:grid-cols-2/.test(overviewSkeleton), "The skeleton must not reserve the removed two-card grid");
    check(overviewSkeleton.includes("lg:grid-cols-3"), "The skeleton must still reserve the three Market Pulse cards");
    check((overviewSkeleton.match(/<article/g) ?? []).length === 4, `The skeleton must reserve exactly four cards now (found ${(overviewSkeleton.match(/<article/g) ?? []).length})`);
    check(!/<table/.test(overviewSkeleton), "The skeleton must not render a table that would reflow into the real one");
    check(!/\d+(\.\d+)?%/.test(overviewSkeleton), "The skeleton must contain no percentage that could read as data");
    check(!/₦|\$\d/.test(overviewSkeleton), "The skeleton must contain no currency figure");
    check(overviewSkeleton.includes("bg-star-900"), "The skeleton must reserve the dark Market Pulse section");

    const tickerSkeleton = renderToStaticMarkup(createElement(MarketTickerSkeleton));
    check(!/Commodit/i.test(tickerSkeleton), "The ticker skeleton must not mention commodities");
    check(!tickerSkeleton.includes("NGX · Stocks"), "The ticker skeleton must not reserve the removed marker column");
    check(!/bg-star-900/.test(tickerSkeleton), "The ticker skeleton must not render the dark marker block");
    // The placeholder scrolling area must be white like the real strip.
    check(/items-center gap-6 overflow-hidden bg-white/.test(tickerSkeleton), "The ticker skeleton viewport must be white to match the redesign");
    check(!/bg-white\/15/.test(tickerSkeleton.slice(tickerSkeleton.indexOf("overflow-hidden bg-white"))), "The skeleton bars must be legible on white");
    check(!/\d+(\.\d+)?%/.test(tickerSkeleton) && !/₦/.test(tickerSkeleton), "The ticker skeleton must contain no figures");
  }

  // --- 15. Withheld prices are labelled and never leaked ----------------
  {
    const withheldStatus: FeedStatus = {
      state: "unavailable",
      asOf: null,
      asOfLabel: "",
      source: "NGN Market",
      note: "The NGX market service reported a quotation timestamp in the future, so the prices cannot be trusted.",
      withheld: true,
    };
    const withheldMarkets = mergeNgxQuotes(featuredNgxEquities, new Map());
    const tickerHtml2 = renderToStaticMarkup(createElement(NgxMarketTicker as never, { markets: withheldMarkets, ngxStatus: withheldStatus }));
    // With the visual badge gone, "Held" must still reach the sr-only summary:
    // refusing untrustworthy prices is materially different from having none.
    check(tickerHtml2.includes("Held"), "a withheld feed must still be described as Held for assistive tech");
    check(tickerHtml2.includes("Prices withheld") && tickerHtml2.includes("untrustworthy timestamp"), "the sr-only summary must explain that prices were withheld");
    check(!/₦\d/.test(tickerHtml2), "no naira price may survive a withheld feed");

    const overviewHtml2 = renderToStaticMarkup(createElement(MarketOverview as never, { markets: withheldMarkets, ngxStatus: withheldStatus, pulse: readyPulse }));
    check(!/₦\d/.test(overviewHtml2), "the at-a-glance table must show no price for a withheld feed");
    check(overviewHtml2.includes("in the future"), "the withheld reason must reach the visitor");
  }

  // --- 16. The safety gate strips prices for an unavailable feed --------
  {
    const liveQuotes = liveNgx;
    const gate = withholdIfUnavailable(liveQuotes, UNAVAILABLE);
    check(gate.every((quote) => quote.priceNgn === null), "the safety gate must strip every price when the feed is unavailable");
    check(gate.every((quote) => quote.changePercent === null && quote.direction === "unknown"), "the safety gate must strip changes and directions too");
    check(gate.length === liveQuotes.length, "the safety gate must preserve every row so tables stay complete");
    check(gate.map((quote) => quote.symbol).join(",") === liveQuotes.map((quote) => quote.symbol).join(","), "the safety gate must not reorder or drop listings");
    const passed = withholdIfUnavailable(liveQuotes, LIVE);
    check(passed.some((quote) => quote.priceNgn !== null), "the safety gate must not strip prices from a healthy feed");
  }

  return problems;
}

const problems = failures();
if (problems.length) {
  console.error(`FAIL — ${problems.length} render assertion(s):\n${problems.map((problem) => "  ✗ " + problem).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("PASS — Market render (REAL components): the strip is one continuous equities-only track on a white background with dark-green symbol and price text, green/red reserved for the daily change and a direction glyph plus screen-reader wording so colour is never the only signal; no commodity content, cell, card or state attribute survives anywhere, and the single quote card spans the full width with no empty grid half left behind; live/stale/delayed/unavailable states each render the correct label and genuine timestamp; no price is ever rendered without a quote; both skeletons match the new one-card geometry and the white strip; and the section fails closed when given no data");
}
