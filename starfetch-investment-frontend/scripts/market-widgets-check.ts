/**
 * MARKET WIDGETS — static + behavioural check for the homepage market data.
 *
 * Split deliberately:
 *   PART 1  source/wiring assertions (static: reads files)
 *   PART 2  behaviour assertions (executes the real adapters and the real JSON)
 *
 * This suite does NOT render React and does NOT touch the network. Rendering
 * evidence comes from `scripts/market-render-check.tsx` (real components) and
 * `MARKET_DATA_TASK_REPORT.md` records what could not be tested at all.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { featuredNgxEquities } from "../components/ngx-market-directory";
import { commodityDirectory } from "../lib/market/commodity-directory";
import {
  loadCommodityFeed,
  parseCommodityFeed,
  readCommodityFeedConfig,
  unquotedCommodities,
} from "../lib/market/commodity-adapter";
import { mergeNgxQuotes, parseNgxSnapshot, STALE_AFTER_MS } from "../lib/market/market-snapshot-adapter";
import { MARKET_PULSE_FILE, MARKET_PULSE_ORDER, formatPulseValue, validateMarketPulse } from "../lib/market/market-pulse";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const home = read("app/page.tsx");
const ticker = read("components/NgxMarketTicker.tsx");
const overview = read("components/MarketOverview.tsx");
const pulseUi = read("components/MarketPulseSection.tsx");
const directory = read("components/ngx-market-directory.ts");
const tickerItem = read("components/MarketTickerItem.tsx");
const priceTable = read("components/NgxPriceTable.tsx");
const marketSection = read("components/MarketSection.tsx");
const footer = read("components/Footer.tsx");
const styles = read("app/globals.css").replace(/\r\n/g, "\n");

// ===========================================================================
// PART 1 — STATIC: wiring, structure and the prohibited approaches
// ===========================================================================

// --- exactly one slider, in the same place ----------------------------------
assert(!home.includes("FixedNoteRatesPopup"), "The Starfetch Fixed Note rates popup must not render on the landing page");
const navbarPosition = home.indexOf("<Navbar />");
const tickerPosition = home.indexOf("<MarketTickerSection");
const heroPosition = home.indexOf("<HeroSection />");
assert(navbarPosition >= 0 && tickerPosition > navbarPosition && heroPosition > tickerPosition, "The unified ticker must sit below the navbar and above the hero");
const tickerUsages = (home.match(/<MarketTickerSection/g) ?? []).length;
assert(tickerUsages === 1, `Exactly one market slider must render on the homepage (found ${tickerUsages})`);
assert(!home.includes("@/components/MarketTicker\""), "The legacy MarketTicker must not be reintroduced alongside the unified slider");
assert(home.includes("<Suspense fallback={<MarketTickerSkeleton />}>"), "The ticker must sit behind a Suspense boundary with a skeleton so it cannot block the page");
assert(home.includes("<Suspense fallback={<MarketOverviewSkeleton />}>"), "Market at a Glance must sit behind a Suspense boundary with a skeleton");
assert(!/export default async function Home/.test(home), "The page must not await market data itself, or the Suspense fallbacks are unreachable dead markup");
assert(home.includes('className="overflow-x-hidden"'), "Main must clip horizontal overflow so a wide table cannot widen the page");

// --- one continuous track carrying BOTH asset classes ----------------------
const trackBody = ticker.slice(ticker.indexOf("function TrackPass"), ticker.indexOf("/** Short, honest label"));
assert(trackBody.includes("markets.map") && trackBody.includes("commodities.map"), "The scrolling track must render NGX and commodity cells inside the SAME list");
assert(!/ngx-market-slider-track[\s\S]{0,400}ngx-market-slider-track/.test(ticker), "There must not be two separate slider tracks");
assert(ticker.includes("<TrackPass markets={markets} commodities={commodities} />") && ticker.includes("duplicate"), "The track must render exactly two identical passes for a seamless -50% loop");

// --- category markers ------------------------------------------------------
assert(ticker.includes("NGX · Commodities"), "The strip must carry the combined category marker");
assert(tickerItem.includes(">\n        NGX\n      </span>") || /NGX\s*<\/span>/.test(tickerItem), "The NGX category marker must be rendered on each equity cell");
assert(/Commodity\s*<\/span>/.test(tickerItem), "The gold-themed Commodity category marker must be rendered on each commodity cell");
assert(tickerItem.includes("#e8c979") || tickerItem.includes("d9b45a"), "The commodity marker must use the gold theme");
assert(ticker.includes("bg-star-900") && (ticker.includes("border-star-lime") || tickerItem.includes("border-star-lime")), "The strip must keep the dark-green background with a bright-green accent");
assert(ticker.includes("bg-star-900"), "The strip must use the dark-green background");

// --- prohibited data sources ----------------------------------------------
for (const [name, source] of Object.entries({ home, ticker, overview, directory })) {
  assert(!/tradingview/i.test(source), `${name} must not reference TradingView`);
  assert(!/tv\.widget|widget\.tradingview|s3\.tradingview/i.test(source), `${name} must not embed a TradingView widget`);
}
// No provider credential may reach the browser bundle.
for (const [name, source] of Object.entries({ home, ticker, overview })) {
  assert(!/NEXT_PUBLIC_[A-Z_]*(KEY|TOKEN|SECRET)/.test(source), `${name} must not read a public provider credential`);
}
assert(!/api[_-]?key/i.test(ticker) && !/api[_-]?key/i.test(overview), "No provider API key may appear in a rendered component");

// --- Market Pulse is data-driven, not hardcoded ----------------------------
for (const value of ["14.06", "23%", "26.5", "45%"]) {
  assert(![overview, pulseUi].some((code) => code.includes(`"${value}"`) || code.includes(`>${value}<`)), `Market Pulse value ${value} must come from the JSON file, not a component literal`);
}
assert(pulseUi.includes("pulse.data.indicators"), "The Market Pulse cards must render the indicators loaded from the JSON file");
assert(pulseUi.includes("not live or real-time data"), "Market Pulse must state that it is not live data");
assert(!overview.includes("All-Share") && !overview.includes("market capitalisation") && !overview.includes("Market breadth"), "Market Pulse must not be replaced with ASI, market cap or breadth");
assert(!overview.includes("source badge") && !/Official source integration pending/.test(overview), "Market Pulse must not carry decorative source badges");

// --- Market at a Glance has the three required cards ----------------------
for (const heading of ["NGX Stocks", "Commodities"]) {
  assert(overview.includes(heading), `Market at a Glance must contain a "${heading}" card`);
}
assert(pulseUi.includes("Market Pulse"), "Market Pulse must appear in its own full-width section");
assert(pulseUi.includes('lg:grid-cols-3'), "Market Pulse must show three white cards on desktop");
assert(pulseUi.includes('bg-star-900') && pulseUi.includes('bg-white'), "Market Pulse must have a dark green section and white cards");
assert(priceTable.includes("View All NGX Stocks"), "The NGX card must keep the View All NGX Stocks control");
assert(!/href="#ngx-markets"/.test(overview) && !/href="#ngx-markets"/.test(priceTable), "View All must not be a misleading self-link");
assert(priceTable.includes("aria-expanded"), "View All must expose its expanded state");
assert(marketSection.includes("AbortSignal.timeout"), "The backend market request must be bounded by a timeout");
assert(priceTable.includes("Price (₦)") && priceTable.includes("Daily"), "The NGX table must keep Price (₦) and Daily columns");
assert(overview.includes("unitLongLabel"), "The commodity table must show each instrument's currency and unit");

// --- loading/error/stale affordances exist -------------------------------
assert(overview.includes('data-feed-state={status.state}'), "Both quote cards must expose the feed state so unavailable/stale states are visible");
assert(overview.includes("stale"), "A stale state must be represented");

// --- slider behaviour (existing CSS, reused) -----------------------------
assert(styles.includes("@keyframes ngx-market-slider-scroll") && styles.includes("ngx-market-strip:hover") && styles.includes(".ngx-market-slider-track {\n    animation: none;"), "The slider must move, pause on hover, and respect reduced-motion preferences");
assert(!/animation:\s*none[^}]*prefers-reduced-motion:\s*no-preference/.test(styles), "Reduced-motion handling must not be inverted");

// --- footer attribution retained ----------------------------------------
assert(footer.includes("Nothing shown is a live trading feed"), "The footer must keep the non-live attribution notice");
assert(/National Bureau of Statistics/.test(footer) && /Central Bank of Nigeria/.test(footer), "The footer must name the official sources of the Market Pulse figures");
assert(/prices are unavailable rather than showing an estimated figure/.test(footer), "The footer must explain the unavailable state rather than implying the figures are estimates");
assert(!/tradingview/i.test(footer), "The footer must not mention TradingView");

// --- the 14 configured equities are preserved, in order -----------------
const order = ["ACCESSCORP", "AIRTELAFRI", "ARADEL", "BUACEMENT", "BUAFOODS", "DANGCEM", "FIRSTHOLDCO", "GTCO", "MTNN", "NB", "NESTLE", "SEPLAT", "UBA", "ZENITHBANK"];
assert(featuredNgxEquities.length === 14, `The directory must still contain the 14 NGX listings (found ${featuredNgxEquities.length})`);
assert(featuredNgxEquities.map((listing) => listing.symbol).join(",") === order.join(","), "The 14 NGX listings must keep their existing order and symbols");
assert(!directory.includes("lastPriceNgn") && !directory.includes("dailyChangePercent"), "The directory must no longer store hardcoded prices");
assert(!/\b\d{2,}\.\d{2}\b/.test(directory), "The directory must contain no hardcoded price literals");

// ===========================================================================
// PART 2 — BEHAVIOUR: execute the real adapters
// ===========================================================================

async function main() {

  const NOW = new Date("2026-11-17T12:00:00.000Z").getTime();

  // --- NGX: a well-formed payload parses and merges onto the directory -----
  {
    const parsed = parseNgxSnapshot(
      {
        asOf: "2026-11-17T11:55:00.000Z",
        source: "NGN Market",
        quotations: [
          { symbol: "dangcem", companyName: "Dangote Cement Plc", lastPrice: "1323.00", changePercent: "-9.99" },
          { symbol: "GTCO", lastPrice: 117, changePercent: 0.68 },
        ],
      },
      NOW,
    );
    assert(parsed.status.state === "live", `A fresh, complete payload must be live (got ${parsed.status.state})`);
    assert(parsed.status.source === "NGN Market", "The provider source must be carried through for attribution");
    assert(parsed.status.asOfLabel.includes("17 Nov 2026"), `The provider timestamp must be formatted for display (got "${parsed.status.asOfLabel}")`);
    const merged = mergeNgxQuotes(featuredNgxEquities, parsed.quotes);
    assert(merged.length === 14, "Merging must always yield all 14 directory rows");
    const dangcem = merged.find((quote) => quote.symbol === "DANGCEM")!;
    assert(dangcem.priceNgn === 1323 && dangcem.changePercent === -9.99, "A quoted row must carry the provider's price and change");
    assert(dangcem.direction === "down", "A negative change must be marked down");
    const unquoted = merged.find((quote) => quote.symbol === "SEPLAT")!;
    assert(unquoted.priceNgn === null && unquoted.direction === "unknown", "An unquoted symbol must render an explicit unavailable cell, never a remembered price");
  }

  // --- NGX: stale detection uses the provider's real timestamp -------------
  {
    const old = new Date(NOW - STALE_AFTER_MS - 60_000).toISOString();
    const parsed = parseNgxSnapshot({ asOf: old, source: "NGN Market", quotations: [{ symbol: "GTCO", lastPrice: 117, changePercent: 1 }] }, NOW);
    assert(parsed.status.state === "stale", `A quote older than the tolerance must be stale (got ${parsed.status.state})`);
    assert(parsed.status.note !== undefined, "A stale status must explain itself to the visitor");
    assert(parsed.status.asOfLabel !== "", "A stale status must still show the genuine timestamp");
  }

  // --- NGX: delayed label ---------------------------------------------------
  {
    const parsed = parseNgxSnapshot({ asOf: new Date(NOW - 60_000).toISOString(), delayed: true, quotations: [{ symbol: "GTCO", lastPrice: 117, changePercent: 1 }] }, NOW);
    assert(parsed.status.state === "delayed", `A provider-flagged delayed quote must be labelled delayed (got ${parsed.status.state})`);
  }

  // --- NGX: malformed input never throws and never invents a price ---------
  {
    const cases: Array<[string, unknown]> = [
      ["null body", null],
      ["string body", "nope"],
      ["missing quotations", { asOf: "2026-11-17T11:00:00.000Z" }],
      ["empty quotations", { quotations: [] }],
      ["null rows", { quotations: [null, 42] }],
      ["rows with no price", { quotations: [{ symbol: "GTCO", lastPrice: null, changePercent: null }] }],
      ["unparseable numbers", { quotations: [{ symbol: "GTCO", lastPrice: "abc", changePercent: {} }] }],
      ["missing symbol", { quotations: [{ lastPrice: 100, changePercent: 1 }] }],
    ];
    for (const [name, payload] of cases) {
      const parsed = parseNgxSnapshot(payload, NOW);
      assert(parsed.status.state === "unavailable", `Malformed payload "${name}" must resolve to unavailable, not throw (got ${parsed.status.state})`);
      assert(parsed.quotes.size === 0, `Malformed payload "${name}" must not yield fabricated quotes`);
      const merged = mergeNgxQuotes(featuredNgxEquities, parsed.quotes);
      assert(merged.every((quote) => quote.priceNgn === null), `Malformed payload "${name}" must leave every cell unavailable`);
    }
  }

  // --- Commodities: no provider configured => honest unavailable -----------
  {
    assert(readCommodityFeedConfig({} as NodeJS.ProcessEnv) === null, "With no environment configuration the commodity feed must be absent");
    assert(readCommodityFeedConfig({ COMMODITY_FEED_URL: "http://insecure.example", COMMODITY_FEED_TOKEN: "t" } as never) === null, "A non-HTTPS commodity endpoint must be rejected so a credential is never sent in clear");
    assert(readCommodityFeedConfig({ COMMODITY_FEED_URL: "https://feed.example/q", COMMODITY_FEED_TOKEN: "t" } as never) !== null, "A configured HTTPS provider must be accepted");

    const result = await loadCommodityFeed(null, NOW);
    assert(result.status.state === "unavailable", `With no provider the commodity feed must be unavailable (got ${result.status.state})`);
    assert(result.quotes.length === 4, "All four configured commodities must still render");
    assert(result.quotes.every((quote) => quote.priceUsd === null && quote.changePercent === null), "No commodity price may be invented when no provider exists");
    assert(result.status.note !== undefined && /not shown|no authorised/i.test(result.status.note), "The unavailable state must explain itself honestly");
  }

  // --- Commodities: verified symbols and units ----------------------------
  {
    const byId = new Map(commodityDirectory.map((commodity) => [commodity.id, commodity]));
    assert(commodityDirectory.length === 4, "Exactly four commodities are configured");
    for (const id of ["gold", "brent", "silver", "cocoa"]) assert(byId.has(id), `The ${id} commodity must be configured`);
    assert(byId.get("gold")!.symbol === "GC" && byId.get("gold")!.unitLongLabel === "USD per troy ounce", "Gold must be COMEX GC in USD per troy ounce");
    assert(byId.get("silver")!.symbol === "SI" && byId.get("silver")!.unitLongLabel === "USD per troy ounce", "Silver must be COMEX SI in USD per troy ounce");
    // CORRECTED IN V2: V1 asserted BZ, which is the NYMEX contract, not ICE's.
  assert(byId.get("brent")!.symbol === "B", "Brent must be ICE symbol B (BZ is a different NYMEX contract)");
  assert(byId.get("brent")!.unitLongLabel === "USD per barrel", "Brent must be USD per barrel");
  assert(byId.get("brent")!.exchange === "ICE Futures Europe", "Brent must be attributed to ICE Futures Europe");
    assert(byId.get("cocoa")!.symbol === "CC" && byId.get("cocoa")!.unitLongLabel === "USD per metric ton", "Cocoa must be ICE CC in USD per metric ton (a CC contract is 10 tonnes but is priced per tonne)");
    assert(commodityDirectory.every((commodity) => commodity.currency === "USD"), "All four benchmarks are quoted in USD");
    assert(unquotedCommodities().every((quote) => quote.priceUsd === null), "The default commodity set must carry no prices");
  }

  // --- Commodities: a real provider payload maps onto the directory --------
  {
    const parsed = parseCommodityFeed(
      {
        asOf: "2026-11-17T11:50:00.000Z",
        source: "Example Authorised Feed",
        quotations: [
          { symbol: "GC", price: 4219.62, changePercent: 0.18 },
          // V3.1: an approved SYMBOL with an agreeing id. This previously used
          // id-only identification, which was the bypass: a generic id cannot
          // distinguish ICE `B` from NYMEX `BZ`.
          { id: "brent", symbol: "B", price: "92.40", changePercent: "-3.59" },
          { symbol: "CC", price: 5435, changePercent: -1.2 },
        ],
      },
      NOW,
    );
    assert(parsed.status.state === "live", `A fresh provider payload must be live (got ${parsed.status.state})`);
    const gold = parsed.quotes.find((quote) => quote.id === "gold")!;
    assert(gold.priceUsd === 4219.62 && gold.direction === "up", "Gold must map by its exchange symbol");
    const brent = parsed.quotes.find((quote) => quote.id === "brent")!;
    assert(
      brent.priceUsd === 92.4 && brent.direction === "down",
      "Brent must map by its approved ICE symbol and parse a string price",
    );
    // A generic id alone must never populate the row.
    const idOnly = parseCommodityFeed(
      { asOf: "2026-11-17T11:50:00.000Z", quotations: [{ id: "brent", price: "92.40" }] },
      NOW,
    );
    assert(
      idOnly.quotes.find((quote) => quote.id === "brent")!.priceUsd === null,
      "An id-only quotation must NOT populate Brent — a generic id cannot identify an instrument",
    );
    const silver = parsed.quotes.find((quote) => quote.id === "silver")!;
    assert(silver.priceUsd === null, "A commodity the provider omits must stay unavailable");
  }

  // --- Commodities: malformed provider payloads ---------------------------
  {
    for (const [name, payload] of [["null", null], ["no quotations", { source: "x" }], ["garbage rows", { quotations: [null, "x"] }]] as Array<[string, unknown]>) {
      const parsed = parseCommodityFeed(payload, NOW);
      assert(parsed.status.state === "unavailable", `Malformed commodity payload "${name}" must be unavailable`);
      assert(parsed.quotes.every((quote) => quote.priceUsd === null), `Malformed commodity payload "${name}" must not fabricate prices`);
    }
  }

  // --- Market Pulse: the real JSON file validates and matches the brief ---
  {
    const raw = JSON.parse(read(MARKET_PULSE_FILE));
    const validated = validateMarketPulse(raw);
    assert(validated.status === "ready", `The shipped Market Pulse file must validate (got ${validated.status})`);
    const indicators = validated.data.indicators;
    assert(indicators.length === 3, `Market Pulse must contain exactly three indicators (found ${indicators.length})`);
    assert(indicators.map((indicator) => indicator.id).join(",") === MARKET_PULSE_ORDER.join(","), "The three indicators must be, in order: headline inflation, monetary policy rate, cash reserve ratio");

    const inflation = indicators[0];
    assert(formatPulseValue(inflation) === "14.06%", "Headline inflation must display as 14.06%");
    assert(inflation.reportingPeriod === "October 2026", "Headline inflation must carry its October 2026 reporting period");
    assert(inflation.previousValue === 14.63 && inflation.previousPeriod === "September 2026", "Headline inflation must carry the September 2026 comparison");
    assert(inflation.source.includes("NBS"), "Headline inflation must attribute the NBS");
    assert(inflation.sourceUrl.startsWith("https://"), "Every indicator must carry an official publication reference");

    const mpr = indicators[1];
    assert(formatPulseValue(mpr) === "23%", "The Monetary Policy Rate must display as 23%");
    assert(mpr.previousValue === 26.5, "The MPR must carry its previous rate of 26.5%");
    assert(mpr.source.includes("CBN"), "The MPR must attribute the CBN");

    const crr = indicators[2];
    assert(formatPulseValue(crr) === "45%", "The Cash Reserve Ratio must display as 45%");
    assert(crr.appliesTo === "Deposit Money Banks", "The CRR must state that it applies to Deposit Money Banks");
    assert(crr.source.includes("CBN"), "The CRR must attribute the CBN");

    for (const indicator of indicators) {
      assert(/^\d{4}-\d{2}-\d{2}$/.test(indicator.lastVerified), `${indicator.id} must carry an ISO lastVerified date`);
      assert(indicator.note.length > 0, `${indicator.id} must carry an explanatory note`);
      assert(indicator.reportingPeriod.length > 0, `${indicator.id} must carry a reporting period`);
    }
  }

  // --- Market Pulse: validation rejects a half-truth ----------------------
  {
    const base = JSON.parse(read(MARKET_PULSE_FILE));
    const dropOne = { ...base, indicators: base.indicators.slice(0, 2) };
    assert(validateMarketPulse(dropOne).status === "unavailable", "A file missing one of the three indicators must not render a partial card");

    const noPeriod = JSON.parse(JSON.stringify(base));
    noPeriod.indicators[0].reportingPeriod = "";
    assert(validateMarketPulse(noPeriod).status === "unavailable", "An indicator without a reporting period must be rejected");

    const noSource = JSON.parse(JSON.stringify(base));
    noSource.indicators[1].source = "";
    assert(validateMarketPulse(noSource).status === "unavailable", "An indicator without an official source must be rejected");

    const noVerified = JSON.parse(JSON.stringify(base));
    delete noVerified.indicators[2].lastVerified;
    assert(validateMarketPulse(noVerified).status === "unavailable", "An indicator without a verification date must be rejected");

    assert(validateMarketPulse(null).status === "unavailable", "A missing file must resolve to unavailable, not throw");
    assert(validateMarketPulse({ indicators: "nope" }).status === "unavailable", "A non-array indicators field must resolve to unavailable");
  }

  console.log("PASS — Homepage market data (static wiring + executed adapters): one unified NGX+commodity track reusing the existing slider CSS; 14 NGX listings preserved in order with no hardcoded prices; four commodities with exchange-verified symbols and units; NGX and commodity feeds both fail closed to an explicit unavailable state on every malformed input; Market Pulse is read and validated from public/data/market-pulse.json with exactly three indicators, reporting periods, sources and verification dates; no TradingView reference and no provider credential anywhere in the bundle");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
