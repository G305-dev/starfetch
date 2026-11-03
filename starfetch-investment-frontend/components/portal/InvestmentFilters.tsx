"use client";

import { Search } from "lucide-react";

type InvestmentFiltersProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
};

/** Search is intentionally limited to the API-provided instrument label. */
export function InvestmentFilters({ searchTerm, onSearchTermChange }: InvestmentFiltersProps) {
  return <section className="mt-6" aria-label="Search investment holdings"><label className="relative block w-full sm:max-w-[390px]"><span className="sr-only">Search investment holdings</span><Search size={21} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-muted" aria-hidden="true" /><input value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} type="search" placeholder="Search investment holdings" className="h-12 w-full rounded-lg border border-star-200 bg-white px-11 text-sm text-star-900 outline-none transition placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label></section>;
}
