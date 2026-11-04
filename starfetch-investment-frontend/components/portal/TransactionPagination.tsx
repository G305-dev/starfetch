"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type TransactionPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function TransactionPagination({ page, pageSize, total, onPageChange }: TransactionPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return <div className="flex flex-col gap-4 border-t border-star-100 pt-5 text-sm text-star-muted sm:flex-row sm:items-center sm:justify-between"><p>Showing {startItem}–{endItem} of {total} transactions</p><nav className="flex items-center gap-2" aria-label="Transaction pagination"><button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page" className="grid h-10 w-10 place-items-center rounded-lg border border-star-200 bg-white text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-45"><ChevronLeft size={17} aria-hidden="true" /></button><span className="min-w-24 text-center text-xs font-bold text-star-700">Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page" className="grid h-10 w-10 place-items-center rounded-lg border border-star-200 bg-white text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-45"><ChevronRight size={17} aria-hidden="true" /></button></nav></div>;
}
