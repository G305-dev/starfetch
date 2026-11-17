/** Display model for the landing-page NGX directory; this is not a backend API contract. */
export type NgxEquityListing = {
  symbol: string;
  companyName: string;
  lastPriceNgn: number | null;
  dailyChangePercent: number | null;
};

/**
 * Frontend-only starter directory of selected NGX-listed equities.
 * Quote fields intentionally remain null until the backend supplies authorized market data.
 * Replace this seed with the backend-provided list when its endpoint is ready.
 */
export const featuredNgxEquities: readonly NgxEquityListing[] = [
  { symbol: "ACCESSCORP", companyName: "Access Holdings Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "AIRTELAFRI", companyName: "Airtel Africa Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "ARADEL", companyName: "Aradel Holdings Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "BUACEMENT", companyName: "BUA Cement Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "BUAFOODS", companyName: "BUA Foods Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "DANGCEM", companyName: "Dangote Cement Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "FIRSTHOLDCO", companyName: "First HoldCo Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "GTCO", companyName: "Guaranty Trust Holding Company Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "MTNN", companyName: "MTN Nigeria Communications Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "NB", companyName: "Nigerian Breweries Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "NESTLE", companyName: "Nestlé Nigeria Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "SEPLAT", companyName: "Seplat Energy Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "UBA", companyName: "United Bank for Africa Plc", lastPriceNgn: null, dailyChangePercent: null },
  { symbol: "ZENITHBANK", companyName: "Zenith Bank Plc", lastPriceNgn: null, dailyChangePercent: null },
];

export const ngxListedEquitiesUrl = "https://ngxgroup.com/exchange/trade/equities/listed-companies/";
