/** Display model for the landing-page NGX directory; this is not a backend API contract. */
export type NgxEquityListing = {
  symbol: string;
  companyName: string;
  lastPriceNgn: number | null;
  dailyChangePercent: number | null;
};

/**
 * Dated market snapshot shown on the landing page.
 *
 * Prices are the NGX close for Tuesday, 17 November 2026, cross-checked
 * between Mansa Markets (mansamarkets.com/nigeria) and Kobo Terminal
 * (koboterminal.com), which agreed on every listing. The session context
 * (ASI -1.38% at 249,318.65, market capitalisation ₦161.88T, Dangote Cement
 * leading decliners at -9.99%) matches same-day Nigerian market reporting
 * (Nairametrics, Tribune, Western Post). This is a snapshot, not a live
 * feed: replace these values with the backend market-data feed when its
 * endpoint is ready.
 */
export const ngxMarketSnapshot = {
  dateLabel: "Tuesday, 17 November 2026 close",
  sourceLabel: "Mansa Markets / Kobo Terminal",
  allShareIndex: 249318.65,
  allShareIndexChangePercent: -1.38,
  marketCapitalisationNgn: 161880000000000,
} as const;

/**
 * Frontend-only directory of selected NGX-listed equities with a dated
 * snapshot of real closing prices. Replace this seed with the
 * backend-provided list when its endpoint is ready.
 */
export const featuredNgxEquities: readonly NgxEquityListing[] = [
  { symbol: "ACCESSCORP", companyName: "Access Holdings Plc", lastPriceNgn: 26.9, dailyChangePercent: -0.37 },
  { symbol: "AIRTELAFRI", companyName: "Airtel Africa Plc", lastPriceNgn: 6258.2, dailyChangePercent: 0 },
  { symbol: "ARADEL", companyName: "Aradel Holdings Plc", lastPriceNgn: 1296, dailyChangePercent: 0 },
  { symbol: "BUACEMENT", companyName: "BUA Cement Plc", lastPriceNgn: 298, dailyChangePercent: 0 },
  { symbol: "BUAFOODS", companyName: "BUA Foods Plc", lastPriceNgn: 760.6, dailyChangePercent: 0 },
  { symbol: "DANGCEM", companyName: "Dangote Cement Plc", lastPriceNgn: 1323, dailyChangePercent: -9.99 },
  { symbol: "FIRSTHOLDCO", companyName: "First HoldCo Plc", lastPriceNgn: 109, dailyChangePercent: 0.09 },
  { symbol: "GTCO", companyName: "Guaranty Trust Holding Company Plc", lastPriceNgn: 117, dailyChangePercent: -0.68 },
  { symbol: "MTNN", companyName: "MTN Nigeria Communications Plc", lastPriceNgn: 837, dailyChangePercent: 0 },
  { symbol: "NB", companyName: "Nigerian Breweries Plc", lastPriceNgn: 70, dailyChangePercent: 0 },
  { symbol: "NESTLE", companyName: "Nestlé Nigeria Plc", lastPriceNgn: 2650, dailyChangePercent: 0 },
  { symbol: "SEPLAT", companyName: "Seplat Energy Plc", lastPriceNgn: 16241.9, dailyChangePercent: 0 },
  { symbol: "UBA", companyName: "United Bank for Africa Plc", lastPriceNgn: 40.5, dailyChangePercent: 0.25 },
  { symbol: "ZENITHBANK", companyName: "Zenith Bank Plc", lastPriceNgn: 116, dailyChangePercent: -0.86 },
];

export const ngxListedEquitiesUrl = "https://ngxgroup.com/exchange/trade/equities/listed-companies/";
