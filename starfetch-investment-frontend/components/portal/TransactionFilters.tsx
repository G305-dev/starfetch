"use client";

import { CalendarDays, ChevronDown, ListFilter, Search, Tags } from "lucide-react";
import { transactionDateRangeOptions, transactionStatusOptions, transactionTypeOptions } from "./transactions-data";

type TransactionFiltersProps = {
  transactionType: string;
  status: string;
  dateRange: string;
  searchTerm: string;
  onTransactionTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
};

function SelectControl({ label, value, onChange, options, icon: Icon }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  icon: typeof Tags;
}) {
  return (
    <label className="relative block min-w-0 flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <Icon size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" />
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full appearance-none rounded-lg border border-star-200 bg-white py-0 pl-11 pr-10 text-sm font-bold text-star-700 outline-none transition hover:border-star-300 focus:border-star-700 focus:ring-2 focus:ring-star-100 sm:w-[210px]">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-star-700" aria-hidden="true" />
    </label>
  );
}

export function TransactionFilters({ transactionType, status, dateRange, searchTerm, onTransactionTypeChange, onStatusChange, onDateRangeChange, onSearchTermChange }: TransactionFiltersProps) {
  return (
    <section className="mt-6 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between" aria-label="Filter transactions">
      <div className="grid gap-3 sm:grid-cols-3 2xl:flex 2xl:flex-wrap">
        <SelectControl label="Transaction type" value={transactionType} onChange={onTransactionTypeChange} options={transactionTypeOptions} icon={Tags} />
        <SelectControl label="Transaction status" value={status} onChange={onStatusChange} options={transactionStatusOptions} icon={ListFilter} />
        <SelectControl label="Transaction date range" value={dateRange} onChange={onDateRangeChange} options={transactionDateRangeOptions} icon={CalendarDays} />
      </div>
      <label className="relative block w-full 2xl:max-w-[345px]">
        <span className="sr-only">Search transactions</span>
        <Search size={21} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-star-muted" aria-hidden="true" />
        <input value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} type="search" placeholder="Search by transaction ID, product or reference..." className="h-12 w-full rounded-lg border border-star-200 bg-white px-11 text-sm text-star-900 outline-none transition placeholder:text-star-muted focus:border-star-700 focus:ring-2 focus:ring-star-100" />
      </label>
    </section>
  );
}
