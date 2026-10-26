"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type InvestmentPaginationProps = {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function InvestmentPagination({ currentPage, totalItems, onPageChange }: InvestmentPaginationProps) {
  const startItem = totalItems === 0 ? 0 : 1;
  const endItem = totalItems;

  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-star-100 pt-5 text-sm text-star-muted sm:flex-row sm:items-center sm:justify-between">
      <p>Showing {startItem}–{endItem} of {totalItems} investments</p>
      <nav className="flex items-center gap-2" aria-label="Investment pagination">
        <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page" className="grid h-10 w-10 place-items-center rounded-lg border border-star-200 bg-white text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft size={17} aria-hidden="true" /></button>
        <button type="button" aria-current="page" onClick={() => onPageChange(1)} className="grid h-10 min-w-10 place-items-center rounded-lg border border-star-lime bg-star-100 px-3 font-extrabold text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">1</button>
        <button type="button" disabled aria-label="Next page" className="grid h-10 w-10 place-items-center rounded-lg border border-star-200 bg-white text-star-700 disabled:cursor-not-allowed disabled:opacity-45"><ChevronRight size={17} aria-hidden="true" /></button>
      </nav>
    </div>
  );
}
