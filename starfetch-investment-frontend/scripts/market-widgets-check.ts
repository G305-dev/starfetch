import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NgxEquityListing } from "../components/ngx-market-directory";

type _NgxListingContract = NgxEquityListing;
const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const home = read("app/page.tsx");
const overview = read("components/MarketOverview.tsx");
const directory = read("components/ngx-market-directory.ts");
const footer = read("components/Footer.tsx");
const entryLines = directory.split("\n").filter((line) => line.includes("{ symbol:"));

assert(!home.includes("FixedNoteRatesPopup"), "The Starfetch Fixed Note rates popup must not render on the landing page");
assert(!home.includes("MarketTicker") && !overview.includes("TradingViewWidget") && !overview.includes("tradingview.com"), "Landing-page market panels must no longer render TradingView data");
assert(overview.includes("featuredNgxEquities") && overview.includes("Search NGX equities") && overview.includes("lastPriceNgn") && overview.includes("dailyChangePercent"), "The market panel must render and search NGX equities with fields ready for backend quotes");
assert(entryLines.length >= 10 && entryLines.every((line) => line.includes("lastPriceNgn: null") && line.includes("dailyChangePercent: null")), "The starter directory must contain selected NGX listings without fabricated quote values");
for (const symbol of ["ACCESSCORP", "DANGCEM", "GTCO", "MTNN", "SEPLAT", "ZENITHBANK"]) {
  assert(directory.includes(`symbol: "${symbol}"`), `Expected NGX listing ${symbol} in the starter directory`);
}
assert(overview.includes("authorized NGX data source") && overview.includes("backend"), "The market panel must clearly explain that live quotes await the backend data connection");
assert(overview.includes("Market Pulse") && overview.includes("Official source integration pending") && overview.includes("Official CBN source integration pending"), "The Market Pulse card must remain visible and its unintegrated indicators must stay clearly pending");
assert(footer.includes("starter directory of selected Nigerian Exchange (NGX)-listed equities") && footer.includes("authorized NGX market-data feed") && !footer.includes("TradingView"), "The footer notice must match the NGX directory and pending quote integration");

console.log("PASS — landing page removes the Fixed Note popup and TradingView widgets, shows selected NGX equities, restores the pending Market Pulse card, and leaves prices blank for backend integration");
