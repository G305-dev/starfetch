/**
 * The 14 NGX-listed companies shown on the homepage, in display order, with
 * their company names.
 *
 * PRICES ARE NOT STORED HERE ANY MORE.
 *
 * The previous version carried a hardcoded 17 November 2026 snapshot of closing
 * prices. Those values are deliberately removed: with a backend feed on its way,
 * a forgotten hardcoded price would silently masquerade as current market data.
 * Quotations now come only from David's `GET /api/v1/public/market-snapshot`
 * (see lib/market/market-snapshot-adapter.ts) and, until that endpoint exists,
 * every cell renders an explicit `Unavailable` state.
 *
 * This file is now purely a directory: ordering and symbols, which the brief
 * requires to be preserved.
 */
export type NgxEquityListing = {
  symbol: string;
  companyName: string;
};

export const featuredNgxEquities: readonly NgxEquityListing[] = [
  { symbol: "ACCESSCORP", companyName: "Access Holdings Plc" },
  { symbol: "AIRTELAFRI", companyName: "Airtel Africa Plc" },
  { symbol: "ARADEL", companyName: "Aradel Holdings Plc" },
  { symbol: "BUACEMENT", companyName: "BUA Cement Plc" },
  { symbol: "BUAFOODS", companyName: "BUA Foods Plc" },
  { symbol: "DANGCEM", companyName: "Dangote Cement Plc" },
  { symbol: "FIRSTHOLDCO", companyName: "First HoldCo Plc" },
  { symbol: "GTCO", companyName: "Guaranty Trust Holding Company Plc" },
  { symbol: "MTNN", companyName: "MTN Nigeria Communications Plc" },
  { symbol: "NB", companyName: "Nigerian Breweries Plc" },
  { symbol: "NESTLE", companyName: "Nestlé Nigeria Plc" },
  { symbol: "SEPLAT", companyName: "Seplat Energy Plc" },
  { symbol: "UBA", companyName: "United Bank for Africa Plc" },
  { symbol: "ZENITHBANK", companyName: "Zenith Bank Plc" },
];

export const ngxListedEquitiesUrl = "https://ngxgroup.com/exchange/trade/equities/listed-companies/";
