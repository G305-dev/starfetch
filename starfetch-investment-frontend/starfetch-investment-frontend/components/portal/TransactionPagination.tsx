"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type TransactionPaginationProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function TransactionPagination({ currentPage, totalItems, pageSize, onPageChange }: TransactionPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-4 border-t border-star-100 pt-5 text-sm text-star-muted sm:flex-row sm:items-center sm:justify-between">
      <p>Showing {startItem}–{endItem} of {totalItems} transactions</p>
      <nav className="flex items-center gap-2" aria-label="Transaction pagination">
        <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page" className="grid h-10 w-10 place-items-center rounded-lg border border-star-200 bg-white text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft size={17} aria-hidden="true" /></button>
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button key={page} type="button" aria-current={currentPage === page ? "page" : undefined} onClick={() => onPageChange(page)} className={`grid h-10 min-w-10 place-items-center rounded-lg border px-3 font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${currentPage === page ? "border-star-lime bg-star-100 text-star-900" : "border-star-200 bg-white text-star-700 hover:bg-star-50"}`}>{page}</button>)}
        <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page" className="grid h-10 w-10 place-items-center rounded-lg border border-star-200 bg-white text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-45"><ChevronRight size={17} aria-hidden="true" /></button>
      </nav>
    </div>
  );
}
