/**
 * MARKET RENDER — RUNTIME test of the REAL homepage market components.
 *
 * Provenance: `[REAL component]`. `NgxMarketTicker` and `MarketOverview` are the
 * shipped files, rendered with `react-dom/server` against controlled props. No
 * network, no database.
 *
 * This covers the states the brief insists on: loading-adjacent empty data,
 * unavailable, stale, delayed and a healthy feed — plus the reduced-motion and
 * single-track structure that can only be verified from rendered markup.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NgxMarketTicker } from "../components/NgxMarketTicker";
import { NgxPriceTable } from "../components/NgxPriceTable";
import { MarketOverviewSkeleton } from "../components/MarketOverviewSkeleton";
import { withholdIfUnavailable } from "../lib/market/withhold";
import { MarketOverview } from "../components/MarketOverview";
import { featuredNgxEquities } from "../components/ngx-market-directory";
import { commodityDirectory } from "../lib/market/commodity-directory";
import { unquotedCommodities } from "../lib/market/commodity-adapter";
import { mergeNgxQuotes, parseNgxSnapshot } from "../lib/market/market-snapshot-adapter";
import type { MarketPulseResult } from "../lib/market/market-pulse";
import type { CommodityQuote, FeedStatus, NgxQuote } from "../lib/market/types";

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

const liveCommodities: CommodityQuote[] = unquotedCommodities().map((quote) =>
  quote.id === "gold" ? { ...quote, priceUsd: 4219.62, changePercent: 0.18, direction: "up" } : quote,
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

const unavailablePulse: MarketPulseResult = { status: "unavailable", note: "Market Pulse is temporarily unavailable while its data file is being updated." };

function failures(): string[] {
  const problems: string[] = [];
  const check = (condition: boolean, message: string) => { if (!condition) problems.push(message); };
  const tickerHtml = (markets: NgxQuote[], commodities: CommodityQuote[], ngxStatus: FeedStatus, commodityStatus: FeedStatus) =>
    renderToStaticMarkup(createElement(NgxMarketTicker as never, { markets, commodities, ngxStatus, commodityStatus }));
  const overviewHtml = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(MarketOverview as never, props));

  // --- 1. ONE continuous track containing both asset classes ---------------
  {
    const html = tickerHtml(liveNgx, liveCommodities, { state: "live", asOf: "2026-11-17T11:55:00.000Z", asOfLabel: "17 Nov 2026, 12:55 WAT", source: "NGN Market" }, UNAVAILABLE);
    const trackCount = (html.match(/ngx-market-slider-track/g) ?? []).length;
    check(trackCount === 1, `Exactly one scrolling track must exist (found ${trackCount})`);
    // Both passes must contain both asset types, interleaved in one list.
    const lists = html.split("ngx-market-slider-group").length - 1;
    check(lists === 2, `The single track must contain exactly two identical passes (found ${lists})`);
    const firstPass = html.slice(html.indexOf("ngx-market-slider-group"), html.indexOf("ngx-market-slider-group", html.indexOf("ngx-market-slider-group") + 1));
    check(firstPass.includes("DANGCEM") && firstPass.includes("Gold"), "The FIRST pass of the track must contain both NGX and commodity cells");
    check(/DANGCEM[\s\S]*Gold|Gold[\s\S]*DANGCEM/.test(firstPass), "NGX and commodity cells must share the same list, not sit in separate blocks");
    check(!html.includes("<section aria-label=\"Nigerian Exchange and global commodity market ticker\"></section>"), "The ticker must render content");
    const sectionCount = (html.match(/aria-label="Nigerian Exchange and global commodity market ticker"/g) ?? []).length;
    check(sectionCount === 1, "There must be exactly one market strip section");
  }

  // --- 2. Live state ------------------------------------------------------
  {
    const html = tickerHtml(liveNgx, liveCommodities, { state: "live", asOf: "2026-11-17T11:55:00.000Z", asOfLabel: "17 Nov 2026, 12:55 WAT", source: "NGN Market" }, UNAVAILABLE);
    check(html.includes("₦1,323.00"), "A live NGX price must render as naira");
    check(html.includes("-9.99%"), "A negative change must render with a minus sign");
    check(html.includes("+0.68%"), "A positive change must render with a plus sign");
    check(html.includes("$4,219.62"), "A commodity price must render in USD");
    check(html.includes("Live · NGN Market"), "The strip must show the live source label");
    check(/text-emerald-300/.test(html), "Positive changes must use the green tone");
    check(/text-red-300/.test(html), "Negative changes must use the red tone");
    check(html.includes("down") && html.includes("up"), "The direction must be available to screen readers, not only as colour");
  }

  // --- 3. Unavailable state (the current production state) ---------------
  {
    const html = tickerHtml(mergeNgxQuotes(featuredNgxEquities, new Map()), unquotedCommodities(), UNAVAILABLE, UNAVAILABLE);
    // V2: each feed reports availability independently, so the strip shows two
    // per-feed lines rather than one combined label.
    check(html.includes("data-ngx-state=\"unavailable\""), "The strip must expose the NGX availability state");
    check(html.includes("data-commodity-state=\"unavailable\""), "The strip must expose the commodity availability state independently");
    check(html.includes("NGX") && html.includes("Cmdty"), "Both feed labels must be present in the strip marker");
    check(html.includes("N/A"), "An unavailable feed must read as N/A rather than implying live data");
    check(!/₦\d/.test(html), "No naira price may be rendered when no quote exists");
    check(!/\$\d/.test(html), "No dollar price may be rendered when no commodity feed exists");
    check((html.match(/Unavailable/g) ?? []).length >= 18, "Every NGX and commodity cell must show an explicit unavailable value");
    check(html.includes("Gold") && html.includes("Cocoa"), "All four commodities must still be listed while unquoted");
  }

  // --- 4. Stale state -----------------------------------------------------
  {
    const stale: FeedStatus = { state: "stale", asOf: "2026-11-17T09:00:00.000Z", asOfLabel: "17 Nov 2026, 10:00 WAT", source: "NGN Market", note: "Showing the last quotation the provider returned; newer prices are not available yet." };
    const html = overviewHtml({ markets: liveNgx, commodities: liveCommodities, ngxStatus: stale, commodityStatus: UNAVAILABLE, pulse: readyPulse });
    check(html.includes('data-feed-state="stale"'), "A stale feed must be labelled in the markup");
    check(html.includes("As of 17 Nov 2026, 10:00 WAT"), "A stale quote must show its genuine timestamp");
    check(html.includes("last quotation the provider returned"), "A stale quote must explain that it is the last known value");
    // The card shows the first 5 listings, so assert on any rendered naira
    // value rather than a symbol that falls outside the subset.
    check(/₦[\d,]+\.\d{2}/.test(html), "A stale quote still shows the last real value rather than blanking it");
  }

  // --- 5. Delayed state ---------------------------------------------------
  {
    const delayed: FeedStatus = { state: "delayed", asOf: "2026-11-17T11:55:00.000Z", asOfLabel: "17 Nov 2026, 12:55 WAT", source: "NGN Market", note: "The provider marks these quotes as delayed." };
    const html = overviewHtml({ markets: liveNgx, commodities: unquotedCommodities(), ngxStatus: delayed, commodityStatus: UNAVAILABLE, pulse: readyPulse });
    check(html.includes('data-feed-state="delayed"'), "A delayed feed must be labelled in the markup");
    check(html.includes("delayed"), "The delayed label must reach the visitor");
  }

  // --- 6. Markets: two quote cards and a separate three-card Market Pulse ---------------
  {
    const html = overviewHtml({ markets: liveNgx, commodities: liveCommodities, ngxStatus: UNAVAILABLE, commodityStatus: UNAVAILABLE, pulse: readyPulse });
    check(html.includes("NGX Stocks"), "Card 1 must be present");
    check(html.includes("Commodities"), "Card 2 must be present");
    check(html.includes("Market Pulse") && html.includes("The numbers shaping Nigerian investing"), "The separate Market Pulse section must be present");
    check((html.match(/<article/g) ?? []).length >= 5, "Two quote cards plus three Market Pulse cards must render");
    check(html.includes("Price (₦)") && html.includes("Daily"), "The NGX table must show its price and change columns");
    check(html.includes("View All NGX Stocks"), "The View All NGX Stocks link must remain");
    check(html.includes("USD per troy ounce") && html.includes("USD per barrel") && html.includes("USD per metric ton"), "The commodity card must state each instrument's currency and unit");
    check(html.includes("14.06%") && html.includes("23%") && html.includes("45%"), "All three Market Pulse figures must render");
    check(html.includes("Deposit Money Banks"), "The CRR row must state its scope");
    check(html.includes("October 2026"), "Market Pulse must show the inflation reporting period");
    check(html.includes("not live or real-time data"), "Market Pulse must state it is not live data");
    check(!html.includes("All-Share") && !html.includes("market capitalisation"), "Market Pulse must not contain ASI or market cap");
    check(html.includes("Symbols and pricing units"), "Commodity provenance must be available unobtrusively");
    // The full 14 must exist in the ticker while the card shows a subset.
    const tickerText = tickerHtml(liveNgx, liveCommodities, UNAVAILABLE, UNAVAILABLE);
    check(tickerText.includes("ZENITHBANK"), "The ticker must carry the full 14-listing directory");
  }

  // --- 7. Market Pulse unavailable ---------------------------------------
  {
    const html = overviewHtml({ markets: liveNgx, commodities: unquotedCommodities(), ngxStatus: UNAVAILABLE, commodityStatus: UNAVAILABLE, pulse: unavailablePulse });
    check(html.includes("Indicators temporarily unavailable"), "An unavailable Market Pulse must say so plainly");
    check(!html.includes("14.06%"), "No stale indicator value may be rendered when the file is unavailable");
    // The NGX/commodity tables legitimately use "—" for blanks; assert no
    // numeric percentage leaked from a pulse figure.
    // Match the rendered figures, not a bare number: "23" can legitimately occur
    // inside a contract note (e.g. a spec reference) without being a pulse value.
    check(
      !/(14\.06|26\.5|45)%/.test(html) && !/>\s*23%\s*</.test(html),
      "No indicator percentage may be rendered when the Market Pulse file is unavailable",
    );
  }

  // --- 8. Commodity card with no provider -------------------------------
  {
    const html = overviewHtml({ markets: liveNgx, commodities: unquotedCommodities(), ngxStatus: UNAVAILABLE, commodityStatus: UNAVAILABLE, pulse: readyPulse });
    check(html.includes('data-feed-state="unavailable"'), "The commodity card must expose the unavailable state");
    // Now that Brent's provenance is surfaced, the card legitimately mentions
    // "$0.01 tick" in its spec note, so assert on a rendered PRICE pattern
    // (currency + 2dp) rather than any dollar sign.
    // Scoped to the price TABLE rather than the whole card: the Brent
    // provenance note legitimately quotes the $0.01 tick size, which is a
    // contract fact, not a market price.
    const commodityTable = html.slice(html.indexOf("Commodity<"), html.indexOf("Symbols and pricing units"));
    check(!/\$[\d,]+\.\d{2}/.test(commodityTable), "No commodity price may be rendered without a provider");
    for (const commodity of commodityDirectory) check(html.includes(commodity.name), `${commodity.name} must still be listed while unavailable`);
  }

  // --- 9. Defaults fail closed ------------------------------------------
  {
    const html = overviewHtml({});
    check(html.includes("Market Pulse"), "The section must still render with no props at all");
    check(!/₦\d/.test(html), "No price may appear when no data is supplied");
    check(!/\d+\.\d+%/.test(html), "No percentage may appear when no data is supplied");
  }

  // --- 10. V2: the ticker reports BOTH feeds independently ---------------
  {
    // NGX live, commodities unavailable — the V1 bug showed a single "Live" label.
    const mixed = tickerHtml(
      liveNgx,
      unquotedCommodities(),
      { state: "live", asOf: "2026-11-17T11:55:00.000Z", asOfLabel: "17 Nov 2026, 12:55 WAT", source: "NGN Market" },
      UNAVAILABLE,
    );
    check(mixed.includes('data-ngx-state="live"'), "The strip must report NGX as live");
    check(mixed.includes('data-commodity-state="unavailable"'), "The strip must report commodities as unavailable at the same time");
    check(mixed.includes("N/A"), "The unavailable commodity feed must be labelled N/A even while NGX is live");
    check(mixed.includes("NGX") && mixed.includes("Cmdty"), "Both per-feed labels must render");

    // Both unavailable.
    const none = tickerHtml(mergeNgxQuotes(featuredNgxEquities, new Map()), unquotedCommodities(), UNAVAILABLE, UNAVAILABLE);
    check((none.match(/N\/A/g) ?? []).length >= 2, "Both feeds must read N/A when neither is available");

    // Both live.
    const liveStatus = { state: "live" as const, asOf: "2026-11-17T11:55:00.000Z", asOfLabel: "17 Nov 2026, 12:55 WAT", source: "NGN Market" };
    const both = tickerHtml(liveNgx, liveCommodities, liveStatus, liveStatus);
    check(both.includes('data-ngx-state="live"') && both.includes('data-commodity-state="live"'), "Both feeds must be individually live");

    // NGX stale, commodities live.
    const ngxStale = { state: "stale" as const, asOf: "2026-11-17T09:00:00.000Z", asOfLabel: "17 Nov 2026, 10:00 WAT", source: "NGN Market" };
    const staleMix = tickerHtml(liveNgx, liveCommodities, ngxStale, liveStatus);
    check(staleMix.includes("Stale"), "A stale NGX feed must be labelled stale");
    check(staleMix.includes('data-commodity-state="live"'), "A live commodity feed must still read live beside a stale NGX feed");
  }

  // --- 11. V2: "View All NGX Stocks" is a real control -------------------
  {
    const collapsed = renderToStaticMarkup(createElement(NgxPriceTable as never, { markets: liveNgx }));
    check(collapsed.includes("View All NGX Stocks"), "The link text must be preserved");
    check(collapsed.includes("<button"), "It must be a real control, not an anchor");
    check(!collapsed.includes('href="#ngx-markets"'), "It must not be the misleading self-link");
    check(collapsed.includes('aria-expanded="false"'), "The control must expose its collapsed state");
    check(collapsed.includes("Show") === false || collapsed.includes("Show fewer") === false, "Expanded-only copy must not appear while collapsed");
    // Count only body rows; the <thead> row also carries a class.
    const collapsedRows = (collapsed.match(/<tr class="transition/g) ?? []).length;
    check(collapsedRows === 5, `The collapsed table must show 5 rows (found ${collapsedRows})`);
    check(collapsed.includes("5 of 14"), "The collapsed state must say how many of the listings are shown");
    check(collapsed.includes("9 more"), "The collapsed state must say how many remain hidden");

    // The component must be capable of rendering all 14.
    check(liveNgx.length === 14, "The table must be given all 14 listings, so expanding can reveal them all");
  }

  // --- 12. V2: the loading skeleton matches the real layout -------------
  {
    const skeleton = renderToStaticMarkup(createElement(MarketOverviewSkeleton));
    check(skeleton.includes('aria-busy="true"'), "The skeleton must be marked busy for assistive tech");
    check(skeleton.includes("Loading market data"), "The skeleton must announce loading to screen readers");
    check(skeleton.includes("lg:grid-cols-2") && skeleton.includes("lg:grid-cols-3"), "Skeleton must reserve the two quote cards and three white Market Pulse cards");
    check(!/<table/.test(skeleton), "The skeleton must not render a table that would reflow into the real one");
    check(!/\d+(\.\d+)?%/.test(skeleton), "The skeleton must contain no percentage that could read as data");
    check(!/₦|\$\d/.test(skeleton), "The skeleton must contain no currency figure");
    check((skeleton.match(/<article/g) ?? []).length === 5, "The skeleton must reserve all five cards across the two sections");
    check(skeleton.includes("bg-star-900"), "The skeleton must reserve the dark Market Pulse section");
  }

  // --- 13. V3: withheld prices are labelled and never leaked -------------
  {
    const withheldStatus: FeedStatus = {
      state: "unavailable",
      asOf: null,
      asOfLabel: "",
      source: "NGN Market",
      note: "The NGX market service reported a quotation timestamp in the future, so the prices cannot be trusted.",
      withheld: true,
    };
    // The adapter discards the quotes; simulate the props a caller would produce.
    const withheldMarkets = mergeNgxQuotes(featuredNgxEquities, new Map());

    const tickerHtml = renderToStaticMarkup(
      createElement(NgxMarketTicker as never, {
        markets: withheldMarkets,
        commodities: unquotedCommodities(),
        ngxStatus: withheldStatus,
        commodityStatus: withheldStatus,
      }),
    );
    check(tickerHtml.includes("Held"), "a withheld feed must be labelled Held, not the vaguer N/A");
    check(
      tickerHtml.includes("Prices withheld") && tickerHtml.includes("untrustworthy timestamp"),
      "the sr-only summary must explain that prices were withheld",
    );
    check(!/₦\d/.test(tickerHtml), "no naira price may survive a withheld feed");
    check(!/\$\d/.test(tickerHtml), "no dollar price may survive a withheld feed");

    const overviewHtml = renderToStaticMarkup(
      createElement(MarketOverview as never, {
        markets: withheldMarkets,
        commodities: unquotedCommodities(),
        ngxStatus: withheldStatus,
        commodityStatus: withheldStatus,
        pulse: readyPulse,
      }),
    );
    check(!/₦\d/.test(overviewHtml), "the at-a-glance tables must show no price for a withheld feed");
    check(overviewHtml.includes("in the future"), "the withheld reason must reach the visitor");
  }

  // --- 14. V3: the safety gate strips prices for an unavailable feed ------
  {
    // Even if a future adapter change hands over populated quotes beside an
    // unavailable status, nothing may render a number.
    const liveQuotes = liveNgx; // these DO carry real prices
    const gate = withholdIfUnavailable(liveQuotes, UNAVAILABLE);
    check(
      gate.every((quote) => quote.priceNgn === null),
      "the safety gate must strip every price when the feed is unavailable",
    );
    check(
      gate.every((quote) => quote.changePercent === null && quote.direction === "unknown"),
      "the safety gate must strip changes and directions too",
    );
    check(gate.length === liveQuotes.length, "the safety gate must preserve every row so tables stay complete");
    check(
      gate.map((quote) => quote.symbol).join(",") === liveQuotes.map((quote) => quote.symbol).join(","),
      "the safety gate must not reorder or drop listings",
    );

    // A healthy feed passes through untouched.
    const liveStatus: FeedStatus = {
      state: "live",
      asOf: "2026-11-17T11:55:00.000Z",
      asOfLabel: "17 Nov 2026, 12:55 WAT",
      source: "NGN Market",
    };
    const passed = withholdIfUnavailable(liveQuotes, liveStatus);
    check(
      passed.some((quote) => quote.priceNgn !== null),
      "the safety gate must not strip prices from a healthy feed",
    );
  }

  return problems;
}

const problems = failures();
if (problems.length) {
  console.error(`FAIL — ${problems.length} render assertion(s):\n${problems.map((problem) => "  ✗ " + problem).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("PASS — Market render (REAL components): one continuous track carries both NGX and commodity cells in a single list; live/stale/delayed/unavailable states each render the correct label and genuine timestamp; no price is ever rendered without a quote; two quote cards and a separate three-card Market Pulse read from the JSON; and the section fails closed when given no data");
}
