/**
 * The four commodities shown on the homepage, with their VERIFIED market
 * symbols and price quotations.
 *
 * Every entry below was checked against the exchange contract specification, not
 * assumed. Sources are recorded per row so a future developer can re-verify.
 *
 * These are identifiers only — NO PRICE IS STORED HERE. Prices arrive from an
 * authorised feed through `commodity-adapter.ts`, or the panel shows an explicit
 * unavailable state. Never add a hardcoded price to this file.
 */

/**
 * Provider-specific symbol aliases.
 *
 * A commodity has ONE authoritative exchange symbol, but data vendors rarely use
 * it verbatim. Rather than hardcoding a vendor's spelling into `symbol` (which is
 * how the V1 Brent error happened), each commodity carries an explicit alias list
 * that `parseCommodityFeed` matches against. Add an alias when a provider's
 * mapping is confirmed — never guess one.
 */
export type ProviderSymbolMapping = {
  /** Vendor or venue this mapping applies to. */
  provider: string;
  /** The ticker that vendor publishes for this instrument. */
  symbol: string;
  /**
   * Whether a quote under this symbol may populate THIS row.
   *
   * - `"approved"`    — the symbol denotes this exact instrument; accept it.
   * - `"different"`   — a genuinely different contract or instrument. NEVER
   *                     accepted for this row. Documented so it can be recognised
   *                     and rejected explicitly rather than silently mapped.
   * - `"unconfirmed"` — believed to denote this instrument but not verified
   *                     against the provider's own documentation. Not accepted
   *                     until an integrator confirms it.
   */
  status: "approved" | "different" | "unconfirmed";
  /**
   * Whether a provider may supply this identifier in a quote's `id` field.
   *
   * The `id` field is a GENERIC label ("brent", "gold"), not a ticker, so it
   * cannot tell a NYMEX `BZ` from an ICE `B` on its own. It may only identify a
   * row when the specific provider has been approved to publish under that label
   * — see `kind` below and the resolution rules in `commodity-adapter.ts`.
   */
  idApprovedForProvider?: boolean;
  /**
   * - `"exchange"` / `"vendor"` — a real instrument ticker.
   * - `"generic"` — a descriptive label a provider may use in `id`. It carries
   *   NO instrument identity on its own, so it can only be trusted when the
   *   configured provider is one that has been approved to publish it.
   */
  kind?: "exchange" | "vendor" | "generic";
  /** Anything the integrator should know about that spelling. */
  note: string;
};

export type CommodityDefinition = {
  /** Stable frontend id used as a React key and feed lookup. */
  id: string;
  name: string;
  /** The benchmark futures symbol AS THE LISTING EXCHANGE PUBLISHES IT. */
  symbol: string;
  exchange: string;
  /** ISO 4217 currency the benchmark contract is quoted in. */
  currency: string;
  /** Unit as the exchange quotes it. */
  unitLabel: string;
  unitLongLabel: string;
  /**
   * The calendar month/year of the contract a continuous front-month quote
   * refers to, when known. Displayed so a visitor knows which contract the
   * price describes.
   */
  contractNote: string;
  /** Where the symbol/unit facts were verified. */
  verification: string;
  /** Known vendor spellings, each confirmed against a provider's own docs. */
  providerSymbols: ProviderSymbolMapping[];
};

export const commodityDirectory: readonly CommodityDefinition[] = [
  {
    id: "gold",
    name: "Gold",
    symbol: "GC",
    exchange: "COMEX",
    currency: "USD",
    unitLabel: "per troy oz",
    unitLongLabel: "USD per troy ounce",
    contractNote: "Front-month COMEX gold futures. One contract is 100 troy ounces.",
    verification: "COMEX GC contract specification: 100 troy ounces, quoted in USD per troy ounce.",
    providerSymbols: [
      { provider: "CME Group / COMEX", symbol: "GC", status: "approved", note: "Native exchange product code; monthly tickers are GCN6-style." },
      { provider: "Generic vendor root", symbol: "GC", status: "approved", note: "Same root at essentially every vendor — gold has no ambiguity." },
      { provider: "Spot venues", symbol: "XAU", status: "different", note: "Spot gold, not the COMEX future. Different instrument; never accepted here." },
    ],
  },
  {
    id: "brent",
    name: "Brent Crude Oil",
    symbol: "B",
    exchange: "ICE Futures Europe",
    currency: "USD",
    unitLabel: "per barrel",
    unitLongLabel: "USD per barrel",
    contractNote:
      "Front-month ICE Brent Crude futures. One contract is 1,000 barrels, quoted in USD per barrel. Physically deliverable via EFP with an option to cash settle against the ICE Brent Index.",
    /**
     * CORRECTED IN V2. V1 recorded the symbol as `BZ` while labelling the
     * exchange "ICE Futures Europe". That conflates two genuinely different
     * contracts:
     *
     *   ICE Brent Crude futures   — symbol `B`   on ICE Futures Europe
     *   Brent Last Day Financial  — symbol `BZ`  on NYMEX (CME Group)
     *
     * `BZ` is a cash-settled NYMEX contract that settles to the ICE Brent Index
     * published a day after the final trading day. It is a financial copy of the
     * ICE benchmark, not the benchmark itself. Calling `BZ` an ICE contract — or
     * showing the NYMEX price under an ICE label — misstates which instrument a
     * visitor is looking at.
     *
     * The homepage shows the ICE benchmark, so the authoritative symbol is `B`.
     * Vendors that only redistribute NYMEX data publish `BZ`, and that price is
     * a different settlement series; it must be labelled as such and is NOT an
     * acceptable substitute without approval.
     */
    verification:
      "ICE Brent Crude Futures contract specification (ICE Futures Europe): contract symbol B, 1,000 barrels, quoted in USD and cents per barrel, $0.01 tick = $10 per contract. NYMEX `BZ` is a separate cash-settled contract referencing the ICE Brent Index — checked separately so the two are never conflated.",
    providerSymbols: [
      { provider: "ICE Futures Europe", symbol: "B", status: "approved", note: "Authoritative exchange symbol for the ICE Brent Crude benchmark contract." },
      {
        provider: "ICE (vendor display root)",
        symbol: "BRN",
        status: "approved",
        note: "ICE's own display root for the Brent Crude futures series (BRN + month code, e.g. BRNZ6). Confirmed to denote the ICE instrument, not a NYMEX copy.",
      },
      {
        provider: "CME Group / NYMEX",
        symbol: "BZ",
        status: "different",
        note: "DIFFERENT CONTRACT — Brent Last Day Financial Futures, cash-settled to the ICE Brent Index published a day after the final trading day. NOT the ICE benchmark. V3: never accepted for this row.",
      },
      {
        provider: "CME Group / NYMEX",
        symbol: "BB",
        status: "different",
        note: "DIFFERENT CONTRACT — Brent Penultimate Financial Futures, settles to the ICE Brent 1st nearby settlement. NOT the ICE benchmark. V3: never accepted for this row.",
      },
    ],
  },
  {
    id: "silver",
    name: "Silver",
    symbol: "SI",
    exchange: "COMEX",
    currency: "USD",
    unitLabel: "per troy oz",
    unitLongLabel: "USD per troy ounce",
    contractNote: "Front-month COMEX silver futures. One contract is 5,000 troy ounces.",
    verification: "COMEX SI contract specification: 5,000 troy ounces, quoted in USD per troy ounce.",
    providerSymbols: [
      { provider: "CME Group / COMEX", symbol: "SI", status: "approved", note: "Native exchange product code; monthly tickers are SIN6-style." },
      { provider: "Generic vendor root", symbol: "SI", status: "approved", note: "Common root for the COMEX future." },
      { provider: "Spot venues", symbol: "XAG", status: "different", note: "Spot silver, not the COMEX future. Different instrument; never accepted here." },
    ],
  },
  {
    id: "cocoa",
    name: "Cocoa",
    symbol: "CC",
    exchange: "ICE Futures U.S.",
    currency: "USD",
    unitLabel: "per metric ton",
    // The brief guessed "per applicable futures contract unit". The real
    // quotation is per metric ton: a CC contract is 10 metric tons but is
    // PRICED per ton, with a $1/ton tick worth $10 per contract. Showing a
    // per-contract figure would overstate the price tenfold.
    unitLongLabel: "USD per metric ton",
    contractNote: "Front-month ICE cocoa futures. One contract is 10 metric tons, priced per metric ton.",
    verification: "ICE Cocoa (CC) contract specification: 10 metric tons, quoted in USD per metric ton.",
    providerSymbols: [
      { provider: "ICE Futures U.S.", symbol: "CC", status: "approved", note: "Native exchange product code for the USD New York contract." },
      { provider: "ICE (vendor display root)", symbol: "CC", status: "approved", note: "Same root at most vendors." },
      {
        provider: "ICE Futures Europe",
        symbol: "C",
        status: "different",
        note: "London cocoa, a DIFFERENT contract quoted in GBP. Never accepted for the USD New York row — the currency and the contract differ.",
      },
    ],
  },
];

export const commodityIds = commodityDirectory.map((commodity) => commodity.id);

/**
 * Every SYMBOL that may populate this commodity's row.
 *
 * ONLY `status: "approved"` mappings are returned, plus the authoritative
 * exchange symbol. A "different" mapping (NYMEX `BZ`/`BB`, spot `XAU`/`XAG`,
 * London cocoa `C`) is deliberately EXCLUDED, which is the entire point of
 * recording it: V2 listed those symbols as aliases, so a NYMEX Brent price could
 * populate the row labelled "ICE Futures Europe".
 *
 * V3.1: the generic `commodity.id` is NOT included here. It used to be, which
 * let a quotation carrying `id: "brent"` bypass every symbol check — a row with
 * `id: "brent"` and `symbol: "BZ"` matched on the id and populated ICE Brent with
 * a NYMEX price. A generic label must never be able to identify an instrument.
 */
export function acceptedSymbols(commodity: CommodityDefinition): string[] {
  return Array.from(
    new Set([
      commodity.symbol.toUpperCase(),
      ...commodity.providerSymbols
        .filter((mapping) => mapping.status === "approved" && mapping.kind !== "generic")
        .map((mapping) => mapping.symbol.toUpperCase()),
    ]),
  );
}

/**
 * The generic labels a provider has EXPLICITLY been approved to publish in the
 * `id` field for this commodity.
 *
 * Empty by default. A provider that wants to identify rows by generic label must
 * be added here deliberately, after its documentation confirms the mapping —
 * because the label alone cannot distinguish `B` from `BZ`.
 *
 * The canonical `commodity.id` counts only when a mapping approves it.
 */
export function approvedProviderIds(commodity: CommodityDefinition): string[] {
  return Array.from(
    new Set(
      commodity.providerSymbols
        .filter((mapping) => mapping.status === "approved" && mapping.idApprovedForProvider === true)
        .map((mapping) => mapping.symbol.toUpperCase()),
    ),
  );
}

/**
 * Symbols that must NEVER populate this row, with the reason. Exposed so the
 * adapter can report a refused mapping rather than silently ignoring it, and so
 * tests can assert the refusal directly.
 */
export function rejectedSymbols(commodity: CommodityDefinition): ProviderSymbolMapping[] {
  return commodity.providerSymbols.filter(
    (mapping) => mapping.status === "different" || mapping.status === "unconfirmed",
  );
}
