import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { featuredNgxEquities, ngxMarketSnapshot, type NgxEquityListing } from "../components/ngx-market-directory";

type _NgxListingContract = NgxEquityListing;
const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const home = read("app/page.tsx");
const ticker = read("components/NgxMarketTicker.tsx");
const overview = read("components/MarketOverview.tsx");
const directory = read("components/ngx-market-directory.ts");
const footer = read("components/Footer.tsx");
const styles = read("app/globals.css");
const entryLines = directory.split("\n").filter((line) => line.includes("{ symbol:"));

assert(!home.includes("FixedNoteRatesPopup"), "The Starfetch Fixed Note rates popup must not render on the landing page");
const navbarPosition = home.indexOf("<Navbar />");
const tickerPosition = home.indexOf("<NgxMarketTicker");
const heroPosition = home.indexOf("<HeroSection />");
assert(navbarPosition >= 0 && tickerPosition > navbarPosition && heroPosition > tickerPosition, "The NGX slider must sit below the navbar and above the hero");
assert(!home.includes("@/components/MarketTicker") && !ticker.includes("TradingViewWidget") && !ticker.includes("tradingview.com") && !overview.includes("TradingViewWidget") && !overview.includes("tradingview.com"), "Landing-page market panels must use NGX values rather than TradingView embeds");
assert(ticker.includes("markets = featuredNgxEquities") && ticker.includes("lastPriceNgn") && ticker.includes("dailyChangePercent") && ticker.includes("Quote pending"), "The navbar slider must render NGX quotes with a pending fallback for unquoted listings");
assert(ticker.includes("17 Nov snapshot"), "The navbar slider must label the dated snapshot it displays");
assert(styles.includes("@keyframes ngx-market-slider-scroll") && styles.includes("ngx-market-strip:hover") && styles.includes(".ngx-market-slider-track {\n    animation: none;"), "The NGX slider must move, pause on hover, and respect reduced-motion preferences");
assert(overview.includes("featuredNgxEquities") && overview.includes("lastPriceNgn") && overview.includes("dailyChangePercent"), "The market panel must render NGX equities with quote fields");
assert(!overview.includes("Search NGX equities") && !overview.includes("Search company or ticker") && !overview.includes("type=\"search\""), "The at-a-glance panel must not render a search bar");
assert(!overview.includes("Official NGX listings") && !overview.includes("ngxListedEquitiesUrl") && !overview.includes("ngxgroup.com"), "The at-a-glance panel must not render the official NGX listings link");
assert(overview.includes("AT_A_GLANCE_LIMIT") && overview.includes("markets.slice(0, AT_A_GLANCE_LIMIT)"), "The at-a-glance panel must show only a subset of the full 14-listing directory");

// --- Dated snapshot of real NGX closing prices (Tuesday, 17 November 2026) ---
assert(entryLines.length === 14, "The directory must contain the 14 selected NGX listings");
assert(entryLines.every((line) => !line.includes("lastPriceNgn: null") && !line.includes("dailyChangePercent: null")), "Every directory listing must carry a real snapshot quote, not a blank placeholder");
assert(ngxMarketSnapshot.dateLabel.includes("17 November 2026"), "The snapshot must be dated to the 17 November 2026 close");
assert(ngxMarketSnapshot.allShareIndex === 249318.65 && ngxMarketSnapshot.allShareIndexChangePercent === -1.38, "The snapshot must record the 17 November 2026 ASI close and daily move");
const bySymbol = new Map(featuredNgxEquities.map((listing) => [listing.symbol, listing]));
const expected: Array<[string, number, number]> = [
  ["ACCESSCORP", 26.9, -0.37],
  ["AIRTELAFRI", 6258.2, 0],
  ["ARADEL", 1296, 0],
  ["BUACEMENT", 298, 0],
  ["BUAFOODS", 760.6, 0],
  ["DANGCEM", 1323, -9.99],
  ["FIRSTHOLDCO", 109, 0.09],
  ["GTCO", 117, -0.68],
  ["MTNN", 837, 0],
  ["NB", 70, 0],
  ["NESTLE", 2650, 0],
  ["SEPLAT", 16241.9, 0],
  ["UBA", 40.5, 0.25],
  ["ZENITHBANK", 116, -0.86],
];
for (const [symbol, price, change] of expected) {
  const listing = bySymbol.get(symbol);
  assert(listing !== undefined, `Expected NGX listing ${symbol} in the directory`);
  assert(listing.lastPriceNgn === price && listing.dailyChangePercent === change, `Snapshot quote for ${symbol} must be ₦${price} (${change}%) from the 17 November 2026 close`);
}
assert(overview.includes("ngxMarketSnapshot") && overview.includes("not a live feed"), "The market panel must attribute the snapshot to its date and source and state it is not a live feed");
assert(overview.includes("backend"), "The market panel must explain that a live backend feed will replace the snapshot when connected");

// --- Market Pulse: latest official indicators ---
assert(overview.includes("Market Pulse"), "The Market Pulse card must remain visible");
assert(overview.includes("14.06%") && overview.includes("NBS"), "Market Pulse must show the October 2026 NBS headline inflation rate");
assert(overview.includes("23%") && overview.includes("CBN"), "Market Pulse must show the current CBN Monetary Policy Rate");
assert(overview.includes("45%"), "Market Pulse must show the current CBN Cash Reserve Ratio for Deposit Money Banks");
assert(!overview.includes("Official source integration pending") && !overview.includes("Official CBN source integration pending"), "Market Pulse indicators must no longer be presented as pending");

assert(footer.includes("dated snapshot") && footer.includes("17 November 2026") && footer.includes("not a live feed") && !footer.includes("TradingView"), "The footer notice must describe the dated snapshot, its non-live status, and keep the awareness disclaimer");

console.log("PASS — landing page keeps the Fixed Note popup removed, restores the moving NGX navbar slider and Market Pulse card, and feeds Market at a Glance with the dated 17 November 2026 NGX snapshot plus official NBS/CBN indicators");
