"use client";

import { ChevronDown, Grid3X3, Search, SlidersHorizontal } from "lucide-react";
import { investmentStatusOptions, investmentTypeOptions } from "./investments-data";

type InvestmentFiltersProps = {
  investmentType: string;
  status: string;
  searchTerm: string;
  onInvestmentTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
};

function SelectControl({ label, value, onChange, options, icon: Icon }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  icon: typeof Grid3X3;
}) {
  return (
    <label className="relative block min-w-0 flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <Icon size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-lg border border-star-200 bg-white py-0 pl-11 pr-10 text-sm font-bold text-star-700 outline-none transition hover:border-star-300 focus:border-star-700 focus:ring-2 focus:ring-star-100 sm:w-[220px]"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" />
    </label>
  );
}

export function InvestmentFilters({ investmentType, status, searchTerm, onInvestmentTypeChange, onStatusChange, onSearchTermChange }: InvestmentFiltersProps) {
  return (
    <section className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" aria-label="Filter investments">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectControl label="Investment type" value={investmentType} onChange={onInvestmentTypeChange} options={investmentTypeOptions} icon={Grid3X3} />
        <SelectControl label="Investment status" value={status} onChange={onStatusChange} options={investmentStatusOptions} icon={SlidersHorizontal} />
      </div>
      <label className="relative block w-full xl:max-w-[390px]">
        <span className="sr-only">Search investments</span>
        <Search size={21} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-muted" aria-hidden="true" />
        <input
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          type="search"
          placeholder="Search investments, products..."
          className="h-12 w-full rounded-lg border border-star-200 bg-white px-11 text-sm text-star-900 outline-none transition placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100"
        />
      </label>
    </section>
  );
}
