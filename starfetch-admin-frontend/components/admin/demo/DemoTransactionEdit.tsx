"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { AdminTransaction } from "./fixtures/admin-transactions-data";

/** Edits one descriptive fixture field in React memory only; never calls an API. */
export function DemoTransactionEdit({ item, onCancel, onSave }: { item: AdminTransaction; onCancel: () => void; onSave: (purpose: string) => void }) {
  const [purpose, setPurpose] = useState(item.detail.purpose);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onCancel);
  closeRef.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    rootRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab") return;
      const nodes = rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = purpose.trim();
    if (!value || value.length > 160) { setError("Enter a purpose between 1 and 160 characters."); return; }
    onSave(value);
  }
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-star-900/45 px-4 py-6" role="presentation"><div ref={rootRef} role="dialog" aria-modal="true" aria-labelledby="demo-edit-title" aria-describedby="demo-edit-description" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-star-700">Demo data only</p><h2 id="demo-edit-title" className="mt-1 text-xl font-extrabold text-star-900">Edit transaction detail</h2></div><button type="button" onClick={onCancel} aria-label="Close edit dialog" className="rounded p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={18}/></button></div><p id="demo-edit-description" className="mt-3 text-sm text-star-muted">Changes to {item.id} exist only in this preview and reset when the page reloads. No data is sent or saved to the backend.</p><form onSubmit={submit} className="mt-5"><label htmlFor="demo-purpose" className="block text-xs font-extrabold text-star-900">Product / funding purpose</label><input id="demo-purpose" value={purpose} maxLength={160} onChange={event => { setPurpose(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby={error ? "demo-purpose-error" : undefined} className="mt-2 h-11 w-full rounded-md border border-star-200 px-3 text-sm text-star-900 outline-none focus:ring-2 focus:ring-star-700"/>{error ? <p id="demo-purpose-error" role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}<p className="mt-2 text-xs text-star-muted">Amounts, balances, statuses, settlement, ledger entries and approvals cannot be edited.</p><div className="mt-6 flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-md border border-star-200 px-4 py-2 text-xs font-bold text-star-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700">Cancel</button><button type="submit" className="rounded-md bg-star-900 px-4 py-2 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700">Save demo change</button></div></form></div></div>;
}
