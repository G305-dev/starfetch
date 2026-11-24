/**
 * MARKET VALIDATION REGRESSION — the V2 corrections.
 *
 * Every case here corresponds to a defect found in V1, or to a rule the V2
 * review asked to be enforced. These are BEHAVIOURAL: the real adapter functions
 * are executed. No network is used except where a fake fetch is injected
 * deliberately to prove the timeout path.
 *
 * Run: node scripts/run-typescript-check.cjs scripts/market-validation-check.ts
 */
import { featuredNgxEquities } from "../components/ngx-market-directory";
import {
  COMMODITY_FEED_TIMEOUT_MS,
  loadCommodityFeed,
  parseCommodityFeed,
} from "../lib/market/commodity-adapter";
import { commodityDirectory, acceptedSymbols, approvedProviderIds, rejectedSymbols } from "../lib/market/commodity-directory";
import { mergeNgxQuotes, parseNgxSnapshot, parseStarfetchMarketSnapshot, STALE_AFTER_MS } from "../lib/market/market-snapshot-adapter";
import {
  FUTURE_TOLERANCE_MS,
  readChangePercent,
  readPrice,
  readQuoteInstant,
} from "../lib/market/validation";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const NOW = new Date("2026-11-17T12:00:00.000Z").getTime();
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const GOOD_QUOTE = { symbol: "GTCO", lastPrice: 117, changePercent: 0.68 };

async function main() {
  // =========================================================================
  // CORRECTION 1 — a `live` status requires a usable price AND a valid,
  // non-future timestamp.
  // =========================================================================

  // --- baseline: a well-formed payload IS live ----------------------------
  {
    const parsed = parseNgxSnapshot({ asOf: iso(-60_000), source: "NGN Market", quotations: [GOOD_QUOTE] }, NOW);
    assert(parsed.status.state === "live", `baseline should be live, got ${parsed.status.state}`);
  }

  // --- missing timestamp must NOT be live --------------------------------
  for (const [name, payload] of [
    ["asOf absent", { quotations: [GOOD_QUOTE] }],
    ["asOf null", { asOf: null, quotations: [GOOD_QUOTE] }],
    ["asOf empty string", { asOf: "", quotations: [GOOD_QUOTE] }],
    ["asOf whitespace", { asOf: "   ", quotations: [GOOD_QUOTE] }],
  ] as Array<[string, unknown]>) {
    const parsed = parseNgxSnapshot(payload, NOW);
    assert(parsed.status.state === "unavailable", `NGX ${name} must be unavailable, got ${parsed.status.state}`);
    assert(parsed.status.asOf === null, `NGX ${name} must report no timestamp`);
    // V3: the PRICES must be gone too, not merely relabelled.
    assert(parsed.quotes.size === 0, `NGX ${name} must return NO quotes (got ${parsed.quotes.size})`);
    const merged = mergeNgxQuotes(featuredNgxEquities, parsed.quotes);
    assert(merged.every((q) => q.priceNgn === null), `NGX ${name} must render every cell unavailable`);
    assert(merged.every((q) => q.changePercent === null), `NGX ${name} must render no change figure`);
    assert(parsed.status.withheld === true, `NGX ${name} must flag that figures were withheld`);
    assert(
      parsed.status.note?.includes("did not report a quotation timestamp"),
      `NGX ${name} must explain the missing timestamp (got "${parsed.status.note}")`,
    );
  }

  // --- invalid timestamp must NOT be live -------------------------------
  for (const bad of ["not-a-date", "2026-13-45T99:99:99Z", "17/11/2026", "{}", "NaN"]) {
    const parsed = parseNgxSnapshot({ asOf: bad, quotations: [GOOD_QUOTE] }, NOW);
    assert(
      parsed.status.state === "unavailable",
      `NGX asOf="${bad}" must be unavailable, got ${parsed.status.state}`,
    );
    assert(parsed.quotes.size === 0, `NGX asOf="${bad}" must return no quotes`);
  }
  {
    // A non-string timestamp is invalid, not usable.
    const parsed = parseNgxSnapshot({ asOf: 1794936000000, quotations: [GOOD_QUOTE] }, NOW);
    assert(parsed.status.state === "unavailable", "NGX numeric asOf must be rejected as unusable");
    assert(parsed.quotes.size === 0, "NGX numeric asOf must return no quotes");
  }

  // --- future-dated timestamp must NEVER be live (V3.1: zero tolerance) --
  // The brief names one minute and ten minutes explicitly; sub-second skew is
  // included because the policy is now absolute.
  assert(FUTURE_TOLERANCE_MS === 0, "the future-timestamp tolerance must be zero");

  for (const offset of [1, 2, 250, 500, 5_000, 30_000, 60_000, 600_000, 3_600_000, 86_400_000]) {
    const parsed = parseNgxSnapshot({ asOf: iso(offset), quotations: [GOOD_QUOTE] }, NOW);
    assert(
      parsed.status.state === "unavailable",
      `NGX asOf ${offset}ms in the future must never be live, got ${parsed.status.state}`,
    );
    assert(
      parsed.status.note?.includes("in the future"),
      `NGX future timestamp must say so (got "${parsed.status.note}")`,
    );
    assert(parsed.quotes.size === 0, `NGX asOf ${offset}ms ahead must return NO quotes`);
    assert(
      parsed.status.withheld === true,
      `NGX asOf ${offset}ms ahead must be marked withheld, not merely unavailable`,
    );
  }

  {
    // The boundary: a quote struck EXACTLY now is legitimate and must stay live.
    // Zero tolerance must mean "no future", not "nothing is ever fresh".
    const atNow = parseNgxSnapshot({ asOf: iso(0), quotations: [GOOD_QUOTE] }, NOW);
    assert(atNow.status.state === "live", `a quote struck exactly now must be live, got ${atNow.status.state}`);
    assert(atNow.quotes.size === 1, "a quote struck exactly now must keep its price");
    // One millisecond ahead is already future-dated.
    const oneMs = parseNgxSnapshot({ asOf: iso(1), quotations: [GOOD_QUOTE] }, NOW);
    assert(oneMs.status.state === "unavailable", "a quote 1ms ahead is future-dated and must be refused");
    assert(oneMs.quotes.size === 0, "a quote 1ms ahead must return no quotes");
  }

  // Commodities obey the same rule, including the exactly-now boundary.
  for (const offset of [1, 500, 5_000, 60_000, 600_000]) {
    const result = parseCommodityFeed(
      { asOf: iso(offset), quotations: [{ symbol: "B", price: 63.4 }] },
      NOW,
    );
    assert(
      result.status.state === "unavailable",
      `commodity asOf ${offset}ms in the future must never be live, got ${result.status.state}`,
    );
    assert(
      result.quotes.every((quote) => quote.priceUsd === null),
      `commodity asOf ${offset}ms ahead must return NO prices`,
    );
    assert(result.status.withheld === true, `commodity asOf ${offset}ms ahead must be marked withheld`);
  }

  // --- negative / zero prices must NOT be live -------------------------
  for (const price of [-1, -117, -0.01, 0]) {
    const parsed = parseNgxSnapshot({ asOf: iso(-60_000), quotations: [{ ...GOOD_QUOTE, lastPrice: price }] }, NOW);
    assert(
      parsed.status.state === "unavailable",
      `NGX price ${price} must not produce a live feed, got ${parsed.status.state}`,
    );
    assert(parsed.quotes.size === 0, `NGX price ${price} must not be stored as a quote`);
  }
  {
    // A negative price on ONE row must not poison a valid row on another.
    const parsed = parseNgxSnapshot(
      {
        asOf: iso(-60_000),
        quotations: [{ symbol: "DANGCEM", lastPrice: -5, changePercent: 1 }, GOOD_QUOTE],
      },
      NOW,
    );
    assert(parsed.status.state === "live", "one bad row must not blank the whole feed");
    assert(!parsed.quotes.has("DANGCEM"), "the negative-price row must be dropped");
    assert(parsed.quotes.has("GTCO"), "the valid row must survive");
    const merged = mergeNgxQuotes(featuredNgxEquities, parsed.quotes);
    const dangcem = merged.find((q) => q.symbol === "DANGCEM")!;
    assert(dangcem.priceNgn === null, "the dropped row must render unavailable, never a negative price");
  }

  // --- responses with no usable price must NOT be live -----------------
  for (const [name, quotations] of [
    ["no rows", []],
    ["null row", [null]],
    ["null price", [{ symbol: "GTCO", lastPrice: null }]],
    ["missing price", [{ symbol: "GTCO", changePercent: 1 }]],
    ["unparseable price", [{ symbol: "GTCO", lastPrice: "abc" }]],
    ["price object", [{ symbol: "GTCO", lastPrice: { amount: 1 } }]],
    ["change only", [{ symbol: "GTCO", changePercent: 1.5 }]],
    ["sentence price", [{ symbol: "GTCO", lastPrice: "one hundred" }]],
  ] as Array<[string, unknown[]]>) {
    const parsed = parseNgxSnapshot({ asOf: iso(-60_000), quotations }, NOW);
    assert(
      parsed.status.state === "unavailable",
      `NGX with ${name} must be unavailable, got ${parsed.status.state}`,
    );
    assert(parsed.quotes.size === 0, `NGX with ${name} must yield no quotes`);
  }

  // --- stale still works, and still needs a real timestamp -------------
  {
    const parsed = parseNgxSnapshot({ asOf: iso(-STALE_AFTER_MS - 60_000), quotations: [GOOD_QUOTE] }, NOW);
    assert(parsed.status.state === "stale", `an old but valid quote must be stale, got ${parsed.status.state}`);
    assert(parsed.status.asOfLabel !== "", "a stale quote must keep its genuine timestamp");
  }

  // --- price/change sanity helpers -------------------------------------
  {
    assert(readPrice("1,323.00") === 1323, "thousands separators must parse");
    assert(readPrice(-1) === null, "negative price must be rejected");
    assert(readPrice(0) === null, "zero price must be rejected");
    assert(readPrice(Infinity) === null, "Infinity must be rejected");
    assert(readChangePercent(-9.99) === -9.99, "a real negative change must survive");
    assert(readChangePercent(-500) === null, "an impossible change must be rejected");
    const future = readQuoteInstant(iso(86_400_000), NOW);
    assert(future.ok === false && future.reason === "future", "a day-ahead timestamp must classify as future");
  }

  // =========================================================================
  // CORRECTION 1 (continued) — the commodity adapter obeys the same rules.
  // =========================================================================
  {
    const live = parseCommodityFeed({ asOf: iso(-60_000), quotations: [{ symbol: "GC", price: 4219.62, changePercent: 0.18 }] }, NOW);
    assert(live.status.state === "live", "baseline commodity payload should be live");

    for (const [name, payload] of [
      ["no asOf", { quotations: [{ symbol: "GC", price: 4219.62 }] }],
      ["null asOf", { asOf: null, quotations: [{ symbol: "GC", price: 4219.62 }] }],
      ["invalid asOf", { asOf: "soon", quotations: [{ symbol: "GC", price: 4219.62 }] }],
      ["future asOf", { asOf: iso(86_400_000), quotations: [{ symbol: "GC", price: 4219.62 }] }],
    ] as Array<[string, unknown]>) {
      const parsed = parseCommodityFeed(payload, NOW);
      assert(
        parsed.status.state === "unavailable",
        `commodity with ${name} must be unavailable, got ${parsed.status.state}`,
      );
      // V3: the prices themselves must be discarded.
      assert(
        parsed.quotes.every((q) => q.priceUsd === null),
        `commodity with ${name} must render no price (found ${parsed.quotes.filter((q) => q.priceUsd !== null).length})`,
      );
      assert(parsed.status.withheld === true, `commodity with ${name} must flag that figures were withheld`);
    }

    for (const price of [-5, 0]) {
      const parsed = parseCommodityFeed({ asOf: iso(-60_000), quotations: [{ symbol: "GC", price }] }, NOW);
      assert(parsed.status.state === "unavailable", `commodity price ${price} must not be live`);
      assert(
        parsed.quotes.every((q) => q.priceUsd === null),
        `commodity price ${price} must not be stored`,
      );
    }
  }

  // =========================================================================
  // CORRECTION 2 — bounded timeout on the commodity request.
  // =========================================================================

  // A fetch that never resolves must abort at the bound, not hang.
  {
    const realFetch = globalThis.fetch;
    let observedSignal: AbortSignal | undefined;
    let aborted = false;

    // Simulates a hung provider: the promise rejects only when the signal fires.
    //
    // The ref'd timer matters. `AbortSignal.timeout()` uses an UNREF'D timer in
    // Node, so a fake fetch that holds no real handle lets the event loop drain
    // and the process exits silently with code 0 before the abort fires — a
    // test that appears to pass by doing nothing. A real socket keeps the loop
    // alive; this timer stands in for it.
    globalThis.fetch = ((_input: unknown, init?: RequestInit) => {
      observedSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        const hold = setTimeout(() => {}, 60_000);
        observedSignal?.addEventListener("abort", () => {
          clearTimeout(hold);
          aborted = true;
          const error = new Error("The operation was aborted.");
          error.name = "AbortError";
          reject(error);
        });
      });
    }) as typeof fetch;

    try {
      const started = Date.now();
      // Watchdog: if the timeout is ever removed from the adapter this call
      // would never settle. Fail with a clear message instead of hanging CI.
      const result = await Promise.race([
        loadCommodityFeed({ url: "https://feed.example/quotes", token: "t" }, NOW, { timeoutMs: 120 }),
        new Promise<never>((_resolve, reject) => {
          const guard = setTimeout(() => reject(new Error("TIMEOUT TEST HUNG: the adapter has no request bound")), 3_000);
          guard.unref?.();
        }),
      ]);
      const elapsed = Date.now() - started;

      assert(observedSignal !== undefined, "the request must carry an AbortSignal");
      assert(aborted, "the request must actually be aborted at the bound");
      assert(elapsed < 2_000, `the timeout must fire promptly (took ${elapsed}ms)`);
      assert(
        result.status.state === "unavailable",
        `a timed-out feed must be unavailable, got ${result.status.state}`,
      );
      assert(
        result.status.note?.includes("did not respond within"),
        `a timeout must be reported as a timeout, not a generic failure (got "${result.status.note}")`,
      );
      assert(
        result.quotes.every((q) => q.priceUsd === null),
        "a timed-out feed must not yield any price",
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  // An outer cancellation must also abort the request.
  {
    const realFetch = globalThis.fetch;
    let aborted = false;
    globalThis.fetch = ((_input: unknown, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const hold = setTimeout(() => {}, 60_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(hold);
          aborted = true;
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }) as typeof fetch;

    try {
      const outer = new AbortController();
      const pending = loadCommodityFeed(
        { url: "https://feed.example/q", token: "t" },
        NOW,
        { signal: outer.signal, timeoutMs: 60_000 },
      );
      outer.abort();
      const result = await pending;
      assert(aborted, "an outer cancellation must propagate to the provider request");
      assert(result.status.state === "unavailable", "a cancelled request must be unavailable");
      assert(
        result.status.note?.includes("could not be reached"),
        "a cancellation must not be mislabelled as a timeout",
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  // A non-2xx response must be unavailable and report the status.
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    try {
      const result = await loadCommodityFeed({ url: "https://feed.example/q", token: "t" }, NOW);
      assert(result.status.state === "unavailable", "a 5xx must be unavailable");
      assert(result.status.note?.includes("503"), `the HTTP status must be surfaced (got "${result.status.note}")`);
    } finally {
      globalThis.fetch = realFetch;
    }
  }

  // The default bound is a sane, documented number.
  {
    assert(
      COMMODITY_FEED_TIMEOUT_MS > 0 && COMMODITY_FEED_TIMEOUT_MS <= 15_000,
      `the default timeout must be bounded and short (got ${COMMODITY_FEED_TIMEOUT_MS}ms)`,
    );
  }

  // =========================================================================
  // CORRECTION 1 (V3) — BZ and BB must NEVER populate the ICE Brent row.
  // =========================================================================
  {
    const brent = commodityDirectory.find((c) => c.id === "brent")!;

    // --- identity -------------------------------------------------------
    assert(brent.symbol === "B", `ICE Brent's exchange symbol is B, not "${brent.symbol}"`);
    assert(brent.exchange === "ICE Futures Europe", "Brent must be attributed to ICE Futures Europe");

    // --- accepted symbols ----------------------------------------------
    const accepted = acceptedSymbols(brent);
    assert(accepted.includes("B"), "the ICE exchange symbol B must be accepted");
    assert(accepted.includes("BRN"), "the confirmed ICE vendor root BRN must be accepted");
    assert(!accepted.includes("BZ"), "BZ must NOT be an accepted symbol for the ICE row");
    assert(!accepted.includes("BB"), "BB must NOT be an accepted symbol for the ICE row");

    // --- BZ/BB alone cannot produce an ICE Brent price ------------------
    for (const symbol of ["BZ", "BB", "bz", "bb"]) {
      const alone = parseCommodityFeed(
        { asOf: iso(-60_000), quotations: [{ symbol, price: 63.4, changePercent: 1.2 }] },
        NOW,
      );
      const brentRow = alone.quotes.find((q) => q.id === "brent")!;
      assert(
        brentRow.priceUsd === null,
        `${symbol.toUpperCase()} alone must NOT populate the ICE Brent row (got ${brentRow.priceUsd})`,
      );
      assert(
        brentRow.changePercent === null,
        `${symbol.toUpperCase()} must not populate an ICE Brent change either`,
      );
      assert(
        brentRow.direction === "unknown",
        `${symbol.toUpperCase()} must not produce a direction on the ICE row`,
      );
      // No commodity at all may be populated by a Brent contract symbol.
      assert(
        alone.quotes.every((q) => q.priceUsd === null),
        `${symbol.toUpperCase()} must not populate ANY commodity row`,
      );
      // The refusal must be reported, with the reason.
      assert(
        (alone.refused ?? []).some((r) => r.symbol === symbol.toUpperCase() && r.commodityId === "brent"),
        `${symbol.toUpperCase()} must be reported as refused for brent, not silently dropped`,
      );
    }

    // --- both together must still not produce an ICE price --------------
    {
      const both = parseCommodityFeed(
        {
          asOf: iso(-60_000),
          quotations: [
            { symbol: "BZ", price: 63.4, changePercent: 1.2 },
            { symbol: "BB", price: 63.1, changePercent: 1.1 },
          ],
        },
        NOW,
      );
      assert(
        both.quotes.find((q) => q.id === "brent")!.priceUsd === null,
        "BZ and BB together must not produce an ICE Brent price",
      );
      assert(
        both.status.state === "unavailable",
        "with only BZ/BB there are no usable prices, so the feed must be unavailable",
      );
    }

    // --- BZ must not corrupt a genuinely quoted ICE row ----------------
    {
      const mixed = parseCommodityFeed(
        {
          asOf: iso(-60_000),
          quotations: [
            { symbol: "BZ", price: 999.99, changePercent: 9 },
            { symbol: "B", price: 63.4, changePercent: 1.2 },
          ],
        },
        NOW,
      );
      const brentPrice: number | null = mixed.quotes.find((q) => q.id === "brent")!.priceUsd;
      assert(brentPrice === 63.4, `a real ICE quote must win over a stray BZ (got ${brentPrice})`);
      assert(
        Number(brentPrice) !== 999.99,
        "the NYMEX BZ price must never appear on the ICE row",
      );
    }

    // --- approved symbols DO work --------------------------------------
    for (const symbol of ["B", "BRN", "brn"]) {
      const ok = parseCommodityFeed(
        { asOf: iso(-60_000), quotations: [{ symbol, price: 63.4, changePercent: 1.2 }] },
        NOW,
      );
      assert(
        ok.quotes.find((q) => q.id === "brent")!.priceUsd === 63.4,
        `${symbol} must populate the ICE Brent row`,
      );
      assert((ok.refused ?? []).length === 0, `${symbol} must not be reported as refused`);
    }

    // --- the mapping table documents the difference --------------------
    const bz = brent.providerSymbols.find((m) => m.symbol === "BZ")!;
    const bb = brent.providerSymbols.find((m) => m.symbol === "BB")!;
    assert(bz.status === "different", "BZ must be recorded as a different contract");
    assert(bb.status === "different", "BB must be recorded as a different contract");
    assert(bz.note.includes("DIFFERENT CONTRACT"), "BZ's note must say it is a different contract");
    assert(bb.note.includes("DIFFERENT CONTRACT"), "BB's note must say it is a different contract");
    assert(
      brent.providerSymbols.find((m) => m.symbol === "BRN")!.status === "approved",
      "BRN must be recorded as approved",
    );
    assert(
      brent.verification.includes("NYMEX `BZ` is a separate"),
      "the verification note must state that BZ is a separate contract",
    );
  }

  // --- the same class of error on the other instruments ---------------
  {
    // ICE London cocoa (C, GBP) must never populate the USD New York row.
    const cocoa = parseCommodityFeed(
      { asOf: iso(-60_000), quotations: [{ symbol: "C", price: 4200, changePercent: 1 }] },
      NOW,
    );
    assert(
      cocoa.quotes.find((q) => q.id === "cocoa")!.priceUsd === null,
      "ICE London cocoa (C) must not be accepted as ICE US cocoa (CC)",
    );
    assert(
      (cocoa.refused ?? []).some((r) => r.symbol === "C" && r.commodityId === "cocoa"),
      "London cocoa C must be reported as refused",
    );

    // Spot metals must not populate the COMEX futures rows.
    for (const [symbol, id] of [["XAU", "gold"], ["XAG", "silver"]] as Array<[string, string]>) {
      const spot = parseCommodityFeed(
        { asOf: iso(-60_000), quotations: [{ symbol, price: 2000, changePercent: 1 }] },
        NOW,
      );
      assert(
        spot.quotes.find((q) => q.id === id)!.priceUsd === null,
        `spot ${symbol} must not populate the ${id} futures row`,
      );
    }
  }

  // =========================================================================
  // REGRESSION GUARD — the V1 eleven-bug shape must stay fixed.
  // =========================================================================
  {
    // The exact V1 failure: quotations present, no asOf -> used to be "live".
    const v1 = parseNgxSnapshot({ quotations: [{ symbol: "GTCO", lastPrice: 117, changePercent: 0.68 }] }, NOW);
    assert(v1.status.state !== "live", "V1 defect: a payload with no timestamp must never be live again");

    // The exact V1 commodity failure: negative price used to be accepted.
    const v1c = parseCommodityFeed({ asOf: iso(-60_000), quotations: [{ symbol: "GC", price: -100 }] }, NOW);
    assert(
      v1c.quotes.every((q) => q.priceUsd === null),
      "V1 defect: a negative commodity price must never be stored again",
    );

    // The exact V1 Brent failure: symbol BZ with exchange ICE.
    const brent = commodityDirectory.find((c) => c.id === "brent")!;
    assert(
      !(brent.symbol === "BZ" && brent.exchange === "ICE Futures Europe"),
      "V1 defect: BZ must never be labelled as an ICE contract again",
    );
  }

  // === V3.1: the generic-id identification bypass ========================
  //
  // V3 matched quotations on EITHER `id` or `symbol`, so a quotation carrying
  // `id: "brent"` bypassed every symbol check. These are the cases independent
  // testing found accepted. Each must now populate NOTHING.

  const commodityAt = (quotations: Array<Record<string, unknown>>) =>
    parseCommodityFeed({ asOf: iso(-60_000), source: "Test Feed", quotations }, NOW);

  const priced = (result: ReturnType<typeof parseCommodityFeed>) =>
    result.quotes.filter((quote) => quote.priceUsd !== null).map((quote) => `${quote.id}=${quote.priceUsd}`);

  for (const [label, quotation] of [
    ["id brent + symbol BZ", { id: "brent", symbol: "BZ", price: 999.99 }],
    ["id brent + symbol BB", { id: "brent", symbol: "BB", price: 999.99 }],
    ["id cocoa + symbol C", { id: "cocoa", symbol: "C", price: 999.99 }],
    ["id gold + symbol XAU", { id: "gold", symbol: "XAU", price: 999.99 }],
    ["id silver + symbol XAG", { id: "silver", symbol: "XAG", price: 999.99 }],
    ["id brent + unknown symbol", { id: "brent", symbol: "UNKNOWN", price: 999.99 }],
    ["id brent + unknown symbol ZZZ", { id: "brent", symbol: "ZZZ", price: 999.99 }],
    ["id gold + symbol B (other row)", { id: "gold", symbol: "B", price: 999.99 }],
    ["lowercase id BRENT + symbol bz", { id: "BRENT", symbol: "bz", price: 999.99 }],
    ["id-only brent (no provider approval)", { id: "brent", price: 999.99 }],
    ["id-only gold (no provider approval)", { id: "gold", price: 999.99 }],
    ["generic label as symbol only", { symbol: "brent", price: 999.99 }],
    ["generic label as symbol with id", { id: "brent", symbol: "brent", price: 999.99 }],
  ] as Array<[string, Record<string, unknown>]>) {
    const result = commodityAt([quotation]);
    assert(
      priced(result).length === 0,
      `a quotation with ${label} must populate NO commodity row (got ${priced(result).join(", ")})`,
    );
    assert(
      result.quotes.every((quote) => quote.priceUsd === null && quote.changePercent === null),
      `a quotation with ${label} must leave every price AND change empty`,
    );
    assert(
      (result.refused ?? []).length > 0,
      `a quotation with ${label} must be REPORTED as refused, not silently dropped`,
    );
  }

  // A conflicting quotation must not disturb a valid one in the same payload.
  {
    const mixed = commodityAt([
      { symbol: "B", price: 63.4, changePercent: 0.5 },
      { id: "brent", symbol: "BZ", price: 999.99, changePercent: -12 },
    ]);
    const brent = mixed.quotes.find((quote) => quote.id === "brent")!;
    const brentPrice: number | null = brent.priceUsd;
    assert(brentPrice === 63.4, `the valid ICE quote must win (got ${brentPrice})`);
    assert(Number(brentPrice) !== 999.99, "the NYMEX price must never appear on the ICE row");
    assert(mixed.quotes.find((quote) => quote.id === "brent")!.changePercent !== -12, "the NYMEX change must not leak either");
    assert(priced(mixed).join(",") === "brent=63.4", `only the ICE quote may be priced (got ${priced(mixed).join(",")})`);
    assert(
      (mixed.refused ?? []).some((entry) => entry.symbol === "BZ" && entry.commodityId === "brent"),
      "the conflicting NYMEX quotation must be reported against the Brent row",
    );
  }

  // Two conflicting quotations, no valid one: ambiguous -> withheld, not guessed.
  {
    const ambiguous = commodityAt([
      { id: "brent", symbol: "BZ", price: 11 },
      { id: "brent", symbol: "BB", price: 22 },
    ]);
    assert(priced(ambiguous).length === 0, "two conflicting claims must not price anything");
    assert(
      ambiguous.quotes.find((quote) => quote.id === "brent")!.priceUsd === null,
      "an ambiguously identified row must be withheld",
    );
  }

  // Agreement between identifying fields is what makes a quotation usable.
  for (const quotation of [
    { id: "brent", symbol: "B", price: 63.4 },
    { id: "brent", symbol: "BRN", price: 63.4 },
    { symbol: "brn", price: 63.4 },
    { id: "BRENT", symbol: "b", price: 63.4 },
  ]) {
    const result = commodityAt([quotation]);
    assert(
      result.quotes.find((quote) => quote.id === "brent")!.priceUsd === 63.4,
      `an approved symbol must still populate ICE Brent (${JSON.stringify(quotation)} produced ${priced(result).join(",") || "nothing"})`,
    );
  }

  // A full legitimate payload still populates all four rows.
  {
    const full = commodityAt([
      { id: "gold", symbol: "GC", price: 4100 },
      { symbol: "B", price: 63.4 },
      { id: "silver", symbol: "SI", price: 51.2 },
      { symbol: "CC", price: 6300 },
    ]);
    assert(
      priced(full).length === 4,
      `every approved symbol must still be matched (got ${priced(full).join(",")})`,
    );
    assert(full.status.state === "live", `a fully valid payload must be live, got ${full.status.state}`);
  }

  // The visitor-facing note must distinguish "nothing sent" from "wrong contract
  // sent and refused" — otherwise an integrator debugs an empty feed that is not
  // empty.
  {
    const allRefused = commodityAt([
      { id: "brent", symbol: "BZ", price: 999.99 },
      { id: "gold", symbol: "XAU", price: 999.99 },
    ]);
    assert(allRefused.status.state === "unavailable", "a fully refused feed must be unavailable");
    assert(
      allRefused.status.note?.includes("cannot be verified as these benchmarks") === true,
      `a refused feed must say so, not claim the provider sent nothing (got "${allRefused.status.note}")`,
    );
    assert(allRefused.status.note?.includes("BZ") === true, "the note must name the refused symbols");

    const empty = commodityAt([]);
    assert(
      empty.status.note?.includes("returned no usable prices") === true,
      "a genuinely empty feed must keep the neutral wording",
    );
  }

  // === V3.2: no change without a price ===================================
  //
  // A percentage change is DERIVED from a price, so it cannot outlive it. The
  // adapter previously read the change independently, so a quotation with a zero,
  // negative, missing or unreadable price still rendered "— ▲ 5.5%": a movement
  // asserted in a figure the feed never supplied.
  {
    const badPrices: Array<[string, unknown]> = [
      ["zero", 0],
      ["negative", -12.5],
      ["missing", undefined],
      ["null", null],
      ["unreadable string", "n/a"],
      ["empty string", ""],
      ["NaN", Number.NaN],
      ["Infinity", Number.POSITIVE_INFINITY],
      ["absurd sentinel", 1e12],
    ];

    for (const [label, price] of badPrices) {
      const quotation: Record<string, unknown> = { symbol: "B", changePercent: 5.5 };
      if (price !== undefined) quotation.price = price;
      const result = commodityAt([quotation]);
      const brent = result.quotes.find((quote) => quote.id === "brent")!;
      assert(brent.priceUsd === null, `a ${label} price must leave priceUsd null`);
      assert(
        brent.changePercent === null,
        `a ${label} price must discard the change too (got ${brent.changePercent})`,
      );
      assert(
        brent.direction === "unknown",
        `a ${label} price must not render a direction (got ${brent.direction})`,
      );
    }

    // Negative changes must not survive either — the sign is not the issue.
    for (const changePercent of [5.5, -5.5, 0, "12.5", "-0.1"]) {
      const result = commodityAt([{ symbol: "B", price: 0, changePercent }]);
      const brent = result.quotes.find((quote) => quote.id === "brent")!;
      assert(
        brent.changePercent === null && brent.direction === "unknown",
        `change ${changePercent} must be discarded alongside an invalid price`,
      );
    }

    // The rule must hold when OTHER commodities in the same feed are valid:
    // a good price elsewhere must not license a change on an unpriced row.
    for (const badPrice of [0, -12.5, undefined, "n/a"]) {
      const rows: Array<Record<string, unknown>> = [
        { symbol: "B", price: 63.4, changePercent: 0.5 },
        { symbol: "GC", changePercent: -9.9 },
      ];
      if (badPrice !== undefined) rows[1].price = badPrice;
      const result = commodityAt(rows);

      const brent = result.quotes.find((quote) => quote.id === "brent")!;
      assert(brent.priceUsd === 63.4 && brent.changePercent === 0.5, "the valid row must be unaffected");
      assert(brent.direction === "up", "the valid row must keep its direction");

      const gold = result.quotes.find((quote) => quote.id === "gold")!;
      assert(gold.priceUsd === null, "the invalid row must stay unpriced");
      assert(
        gold.changePercent === null,
        `a mixed feed must not leak a change onto the unpriced row (bad price: ${String(badPrice)}, got ${gold.changePercent})`,
      );
      assert(gold.direction === "unknown", "a mixed feed must not leak a direction onto the unpriced row");

      assert(result.status.state === "live", "one valid price still makes the feed live");
    }

    // And the converse: a valid price still keeps its change, including 0 (flat).
    {
      const result = commodityAt([
        { symbol: "B", price: 63.4, changePercent: 0 },
        { symbol: "GC", price: 4100, changePercent: -1.2 },
        { symbol: "SI", price: 51.2, changePercent: "2.5" },
      ]);
      const byId = new Map(result.quotes.map((quote) => [quote.id, quote]));
      assert(byId.get("brent")!.changePercent === 0, "a zero change on a valid price is real, not missing");
      assert(byId.get("brent")!.direction === "flat", "a zero change is flat, not unknown");
      assert(byId.get("gold")!.changePercent === -1.2 && byId.get("gold")!.direction === "down", "a valid change survives");
      assert(byId.get("silver")!.changePercent === 2.5 && byId.get("silver")!.direction === "up", "a string-encoded change survives");
    }
  }

  // A quotation for ANOTHER row is not a refusal — it is a price for that row.
  {
    const twoRows = commodityAt([
      { symbol: "B", price: 63.4 },
      { symbol: "GC", price: 4100 },
    ]);
    assert(priced(twoRows).sort().join(",") === "brent=63.4,gold=4100", "each row takes its own symbol");
    assert(
      !(twoRows.refused ?? []).some((entry) => entry.symbol === "GC" && entry.commodityId === "brent"),
      "a valid symbol for another commodity must not be reported as refused",
    );
  }

  // The identifier sets themselves must stay honest.
  for (const commodity of commodityDirectory) {
    assert(
      !acceptedSymbols(commodity).includes(commodity.id.toUpperCase()),
      `the generic id "${commodity.id}" must never be an accepted SYMBOL`,
    );
    assert(
      approvedProviderIds(commodity).length === 0,
      `no provider is approved for id-only identification of "${commodity.id}"`,
    );
  }

  // David's actual NestJS backend contract (synthetic, no external calls).
  // The homepage consumes `{data: {equities, cache, status, dataType}}`, NOT
  // the superseded `{quotations, asOf}` assumptions above.
  {
    const equity = (symbol: string, ageMs = 60_000) => ({
      symbol,
      companyName: symbol,
      lastPriceNgn: 117,
      dailyChangePercent: 1.4,
      quoteTimestamp: iso(-ageMs),
      available: true,
      unavailableReason: null,
    });
    const backend = (equities: unknown[], status: "ok" | "stale" = "ok", isStale = false) => ({
      data: {
        status,
        provider: { name: "NGN Market", url: "https://ngnmarket.com", attribution: "Market data provided by NGN Market (ngnmarket.com)." },
        dataType: "delayed",
        delayNotice: "Delayed data, not real-time.",
        cache: { refreshedAt: iso(-1_000), ageSeconds: 1, refreshIntervalSeconds: 1800, nextRefreshDueAt: iso(1800000), isStale, staleReason: isStale ? "REFRESH_FAILED" : null },
        equities,
        marketSummary: null,
        generatedAt: iso(-500),
      },
      meta: { requestId: "test" },
    });
    const valid = parseStarfetchMarketSnapshot(backend([equity("GTCO")]), NOW);
    assert(valid.status.state === "delayed" && valid.quotes.get("GTCO")?.priceNgn === 117,
      "real backend response must parse and remain delayed (never live)");
    assert(valid.status.source?.includes("ngnmarket.com") === true, "backend provider attribution must survive");
    assert(valid.status.asOf === iso(-60_000), "quoteTimestamp, never refreshedAt/generatedAt, drives displayed asOf");
    assert(valid.quotes.get("GTCO")?.changePercent === 1.4, "dailyChangePercent must map through unchanged");

    const partial = parseStarfetchMarketSnapshot(backend([
      equity("GTCO"),
      { ...equity("DANGCEM"), available: false, lastPriceNgn: 99 },
      { ...equity("UBA"), quoteTimestamp: iso(1) },
      { ...equity("MTNN"), quoteTimestamp: null },
      { ...equity("NB"), lastPriceNgn: -1 },
    ]), NOW);
    assert(partial.quotes.size === 1 && partial.quotes.has("GTCO"),
      "unavailable/future/missing timestamp/negative rows must be withheld without poisoning valid rows");

    const old = parseStarfetchMarketSnapshot(backend([equity("GTCO", STALE_AFTER_MS + 10_000)]), NOW);
    assert(old.status.state === "delayed" && old.status.asOf === iso(-STALE_AFTER_MS - 10_000),
      "older valid quotation must remain delayed with its genuine timestamp");
    const paused = parseStarfetchMarketSnapshot(backend([equity("GTCO")], "stale", true), NOW);
    assert(paused.status.state === "stale", "backend stale signal must override fresh quote timestamp");
    const staleStatusOnly = parseStarfetchMarketSnapshot(backend([equity("GTCO")], "stale", false), NOW);
    assert(staleStatusOnly.status.state === "stale", "backend stale status must be respected");
    const staleCacheOnly = parseStarfetchMarketSnapshot(backend([equity("GTCO")], "ok", true), NOW);
    assert(staleCacheOnly.status.state === "stale", "backend cache stale flag must be respected");
    const earliest = parseStarfetchMarketSnapshot(backend([equity("GTCO", 60_000), equity("UBA", 120_000)]), NOW);
    assert(earliest.status.asOf === iso(-120_000), "shared As of must be the oldest displayed quotation");
    const duplicate = parseStarfetchMarketSnapshot(backend([equity("GTCO"), equity("GTCO")]), NOW);
    assert(duplicate.quotes.size === 0 && duplicate.status.state === "unavailable", "duplicate symbols cannot silently win");
    const futureOnly = parseStarfetchMarketSnapshot(backend([{ ...equity("GTCO"), quoteTimestamp: iso(1) }]), NOW);
    assert(futureOnly.quotes.size === 0 && futureOnly.status.withheld === true,
      "future timestamps from backend cannot leak prices");
    const missingAttribution = backend([equity("GTCO")]);
    missingAttribution.data.provider.attribution = "";
    assert(parseStarfetchMarketSnapshot(missingAttribution, NOW).quotes.size === 0,
      "no NGN Market attribution means no public prices");
    assert(parseStarfetchMarketSnapshot({ data: { quotations: [GOOD_QUOTE] } }, NOW).quotes.size === 0,
      "old assumed contract must not be accepted on the production endpoint");
    assert(parseStarfetchMarketSnapshot(backend([equity("GTCO", 8 * 24 * 60 * 60 * 1000)]), NOW).quotes.size === 0,
      "quotes older than seven days must not be served");
    console.log("PASS — David NGN Market backend v1 contract: envelope, field mapping, quote timestamps, delayed/stale, withheld rows, attribution, duplicates and seven-day cutoff");
  }

  console.log(
    "PASS — Market validation regression: a live status now requires both a real price and a present, readable, non-future timestamp (missing/invalid/future all resolve to unavailable with a specific explanation); negative and zero prices are rejected per row without poisoning other rows; the commodity request is bounded by an AbortSignal that fires on timeout AND on outer cancellation, reporting a timeout distinctly from a network failure and surfacing non-2xx status codes; Brent is identified as ICE symbol B with BRN documented and NYMEX BZ explicitly recorded as a DIFFERENT contract; ICE London cocoa C is not accepted as CC",
  );
}

// If the event loop ever drains before main() settles, Node would exit 0 with
// no output — a test that "passes" by never running. Fail loudly instead.
let settled = false;
process.on("exit", (code) => {
  if (!settled && code === 0) {
    console.error("FAIL — the check exited before completing; an awaited promise never settled.");
    process.exitCode = 1;
  }
});

main()
  .then(() => {
    settled = true;
  })
  .catch((error) => {
    settled = true;
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
