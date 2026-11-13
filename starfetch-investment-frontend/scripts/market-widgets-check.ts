import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AuthUser } from "../lib/api/client";

// Keeps this standalone source check on the same project-root compilation path as the other checks.
type _AuthUserContract = AuthUser;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const embed = read("components/TradingViewWidget.tsx");
const ticker = read("components/MarketTicker.tsx");
const overview = read("components/MarketOverview.tsx");
const footer = read("components/Footer.tsx");
const siteData = read("components/site-data.ts");

assert(embed.includes("useEffect") && embed.includes("container.replaceChildren()") && embed.includes("script.async = true") && embed.includes("script.textContent = configurationJson"), "TradingView embeds must mount their official script once after hydration and clean up on unmount");
assert(ticker.includes("embed-widget-ticker-tape.js") && ticker.includes("displayMode: \"adaptive\"") && ticker.includes("FOREXCOM:SPXUSD") && ticker.includes("FOREXCOM:NSXUSD") && ticker.includes("FOREXCOM:DJI") && ticker.includes("FX:EURUSD") && ticker.includes("TVC:GOLD") && ticker.includes("BITSTAMP:BTCUSD") && ticker.includes("BITSTAMP:ETHUSD"), "Ticker Tape must use official TradingView-supported global instruments");
assert(!ticker.includes("marketTickerItems") && !ticker.includes("animate-"), "Ticker values and movement must come from TradingView, not local placeholders or manual animation");
assert(overview.includes("embed-widget-market-overview.js") && overview.includes("Supported global markets") && overview.includes("does not currently include Nigerian Exchange (NGX) equities") && !overview.includes("marketEquities") && !overview.includes("<table"), "Market overview must replace the NGX placeholder table with clearly labelled supported global data");
assert(overview.includes("Official source integration pending") && overview.includes("Official CBN source integration pending"), "Market Pulse must retain pending official-data states rather than map policy indicators to TradingView prices");
assert(!siteData.includes("marketTickerItems") && !siteData.includes("marketEquities"), "Replaced market placeholders must not remain in shared site data");
assert(footer.includes("supplied through TradingView widgets") && footer.includes("Nigerian Exchange (NGX) prices are not displayed") && !footer.includes("licensed redistributor of Nigerian Exchange data"), "Footer market-data notice must describe the actual widget provider and avoid an unverified NGX claim");

console.log("PASS — official TradingView ticker/market widgets replace local market placeholders, avoid unsupported NGX claims, and preserve pending policy indicators");
