"use client";

import { AlertCircle, LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function AdminSectionCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-xl border border-[#e7ece7] bg-white shadow-[0_3px_12px_rgba(23,51,30,0.035)] ${className}`}>{children}</section>;
}

/** State rendering for future authorized reads; no fetch or demo data is performed here. */
export function DataState({ state, title, onRetry }: { state: "unavailable" | "loading" | "empty" | "error"; title: string; onRetry?: () => void }) {
  const text = state === "loading" ? "Loading…" : state === "error" ? "Unable to load data. Please try again." : state === "empty" ? "No records available." : "Awaiting backend integration.";
  return <div role={state === "error" ? "alert" : "status"} aria-busy={state === "loading"} className="flex min-h-[126px] flex-col items-center justify-center gap-2 px-5 py-7 text-center"><span className="grid size-9 place-items-center rounded-full bg-star-50 text-star-700">{state === "loading" ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true"/> : <AlertCircle size={18} aria-hidden="true"/>}</span><p className="text-xs font-extrabold text-[#23392a]">{title}</p><p className="text-xs text-[#738078]">{text}</p>{state === "error" && onRetry ? <button type="button" onClick={onRetry} className="mt-2 rounded-md bg-star-900 px-4 py-2 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700">Retry</button> : null}</div>;
}

export function SummaryCards({ items }: { items: { title: string; icon: LucideIcon }[] }) {
  return <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{items.map(({ title, icon: Icon }) => <AdminSectionCard key={title} className="flex min-h-[112px] items-start gap-3 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#edf9dc] text-star-700"><Icon size={20} aria-hidden="true"/></span><div><h2 className="text-[11px] font-bold text-[#202d24]">{title}</h2><p className="mt-2 text-2xl font-extrabold text-[#101b13]">—</p><p className="mt-1 text-[10px] text-[#738078]">Not available yet</p></div></AdminSectionCard>)}</section>;
}

export function UnavailableTable({ title, columns, message, actions = [] }: { title: string; columns: string[]; message: string; actions?: string[] }) {
  return <AdminSectionCard className="overflow-hidden"><div className="px-4 pt-4"><h2 className="text-[15px] font-extrabold text-[#17271b]">{title}</h2></div><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] border-collapse text-left"><thead className="bg-[#f5f8f5] text-[10px] font-bold text-[#526157]"><tr>{columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-4 py-3">{column}</th>)}{actions.length ? <th scope="col" className="px-4 py-3">Actions</th> : null}</tr></thead><tbody><tr><td colSpan={columns.length} className="px-4 py-5"><p className="text-xs font-semibold text-[#516359]" role="status">{message}</p><p className="mt-1 text-[11px] text-[#738078]">Awaiting an authorized backend data source.</p></td>{actions.length ? <td className="px-4 py-5"><div className="flex flex-wrap gap-2">{actions.map(action => <button type="button" key={action} disabled title={`${action} is unavailable until an authorized backend contract is provided.`} className="rounded-md border border-[#dce7db] px-3 py-1.5 text-xs font-bold text-[#738078] disabled:cursor-not-allowed disabled:opacity-60">{action}</button>)}</div></td> : null}</tr></tbody></table></div></AdminSectionCard>;
}
