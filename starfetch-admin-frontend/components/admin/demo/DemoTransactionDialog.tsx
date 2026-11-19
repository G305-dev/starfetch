"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { AdminAccountTypeBadge, AdminStatusBadge } from "./AdminBadges";
import { formatMockMoney } from "./fixtures/admin-users-data";
import type { AccountType } from "./fixtures/admin-dashboard-data";
import type { AdminTransaction, TransactionType } from "./fixtures/admin-transactions-data";
import { transactionStatuses, type TransactionStatus } from "./transaction-status";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-700";
const input = "mt-1.5 min-h-10 w-full rounded-md border border-[#d8e2d8] bg-white px-3 py-2 text-sm text-star-900 outline-none focus:ring-2 focus:ring-star-700";
const transactionTypes: TransactionType[] = ["Deposit", "Withdrawal", "Investment Funding", "Redemption", "Return / Distribution", "Transfer"];
const accountTypes: AccountType[] = ["Individual", "Joint", "Corporate"];

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLElement>("[data-dialog-initial]")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab") return;
      const nodes = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-star-900/50 p-3 sm:p-6"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title" aria-describedby="transaction-dialog-description" className="flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"><div className="flex items-start justify-between gap-4 border-b border-[#e6ede6] px-5 py-4 sm:px-6"><div><p className="text-[10px] font-extrabold uppercase tracking-wide text-star-700">Synthetic demo only</p><h2 id="transaction-dialog-title" className="mt-1 text-xl font-extrabold text-star-900">{title}</h2></div><button type="button" data-dialog-initial onClick={onClose} aria-label={`Close ${title}`} className={`rounded p-2 text-[#56705d] ${focus}`}><X size={20}/></button></div><div className="overflow-y-auto px-5 py-4 sm:px-6"><p id="transaction-dialog-description" className="mb-4 text-xs leading-5 text-[#687a6d]">Demo data only. No real approvals, payments, settlement or ledger updates occur. Never enter real customer information.</p>{children}</div></div></div>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0 rounded-lg bg-[#f6f9f5] px-3 py-3"><dt className="text-[11px] font-semibold text-[#6a7b6f]">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-[#203a29]">{children || "Not provided"}</dd></div>;
}

export function ViewTransactionDialog({ item, onClose }: { item: AdminTransaction; onClose: () => void }) {
  return <Dialog title="View Transaction" onClose={onClose}><dl className="grid gap-2 sm:grid-cols-2"><Detail label="Transaction ID">{item.id}</Detail><Detail label="Investor">{item.investor}</Detail><Detail label="Investor Email">{item.email}</Detail><Detail label="Account Type"><AdminAccountTypeBadge type={item.accountType}/></Detail><Detail label="Account Reference">{item.accountReference}</Detail><Detail label="Transaction Type">{item.type}</Detail><Detail label="Amount">{formatMockMoney(item.amount)}</Detail><Detail label="Status"><AdminStatusBadge status={item.status}/></Detail><Detail label="Payment Method">{item.paymentMethod}</Detail><Detail label="Transaction Date">{item.createdAt}</Detail><Detail label="Investment Reference">{item.investmentReference}</Detail><Detail label="Purpose">{item.detail.purpose}</Detail><Detail label="Payment Reference">{item.detail.referenceNumber}</Detail><Detail label="Notes">{item.detail.notes}</Detail><Detail label="Completed Date">{item.detail.completedAt}</Detail></dl>
    {item.detail.activity.length > 0 && <section className="mt-5"><h3 className="text-sm font-extrabold text-star-900">Sample Activity Log (original fixture)</h3><ul className="mt-2 space-y-2">{item.detail.activity.map((event, index) => <li key={`${event.action}-${index}`} className="rounded-lg border border-[#e7eee6] p-3 text-xs leading-5"><strong>{event.action}</strong> · {event.timestamp} · {event.actor}{event.note && <p>{event.note}</p>}</li>)}</ul></section>}
    {item.detail.related.length > 0 && <section className="mt-5"><h3 className="text-sm font-extrabold text-star-900">Sample Related Transactions (original fixture)</h3><ul className="mt-2 space-y-2">{item.detail.related.map(related => <li key={related.id} className="rounded-lg border border-[#e7eee6] p-3 text-xs leading-5"><strong>{related.id}</strong> · {related.type} · {formatMockMoney(related.amount)} · {related.status} · {related.date}</li>)}</ul></section>}
    <div className="mt-6 flex justify-end"><button type="button" onClick={onClose} className={`rounded-md bg-star-900 px-5 py-2.5 text-xs font-bold text-white ${focus}`}>Close</button></div>
  </Dialog>;
}

type Draft = { investor: string; email: string; accountType: AccountType; accountReference: string; type: TransactionType; amount: string; status: TransactionStatus; paymentMethod: string; created: string; investmentReference: string; purpose: string; paymentReference: string; notes: string };
function initialDraft(item?: AdminTransaction): Draft {
  return { investor:item?.investor ?? "", email:item?.email ?? "", accountType:item?.accountType ?? "Individual", accountReference:item?.accountReference ?? "", type:item?.type ?? "Deposit", amount:item ? String(item.amount) : "", status:item?.status ?? "Pending Approval", paymentMethod:item?.paymentMethod ?? "", created:item?.created ?? "", investmentReference:item?.investmentReference ?? "", purpose:item?.detail.purpose ?? "", paymentReference:item?.detail.referenceNumber ?? "", notes:item?.detail.notes ?? "" };
}
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function TransactionFormDialog({ item, onClose, onSave }: { item?: AdminTransaction; onClose: () => void; onSave: (value: Omit<AdminTransaction, "id">) => void }) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(item));
  const [error, setError] = useState("");
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDraft(current => ({...current, [key]: value})); setError(""); };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.investor.trim() || !draft.accountReference.trim() || !draft.paymentMethod.trim() || !draft.purpose.trim()) { setError("Enter an investor, account reference, payment method and purpose."); return; }
    if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(draft.amount) || !Number.isFinite(Number(draft.amount)) || Number(draft.amount) <= 0 || Number(draft.amount) > 1000000000000) { setError("Enter an amount above zero and no more than 1,000,000,000,000, with up to two decimal places."); return; }
    if (!validDate(draft.created)) { setError("Enter a valid transaction date."); return; }
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) { setError("Enter a valid synthetic email, or leave it blank."); return; }
    onSave({ investor:draft.investor.trim(), email:draft.email.trim(), accountReference:draft.accountReference.trim(), accountType:draft.accountType, type:draft.type, amount:Number(draft.amount), status:draft.status, paymentMethod:draft.paymentMethod.trim(), created:draft.created, createdAt:item?.created === draft.created ? item.createdAt : draft.created, investmentReference:draft.investmentReference.trim() || undefined, detail:{ purpose:draft.purpose.trim(), referenceNumber:draft.paymentReference.trim(), notes:draft.notes.trim(), completedAt:item?.detail.completedAt ?? "Not provided in sample", timeline:item?.detail.timeline ?? [], approvals:item?.detail.approvals ?? [], activity:item?.detail.activity ?? [], related:item?.detail.related ?? [] } });
  }
  return <Dialog title={item ? "Edit Transaction" : "Add Transaction"} onClose={onClose}><form onSubmit={submit} noValidate><div className="grid gap-4 sm:grid-cols-2">
    <label className="text-xs font-bold text-[#38513e]">Transaction ID<input readOnly value={item?.id ?? "Assigned on save"} className={`${input} bg-[#f3f6f2]`}/></label>
    <label className="text-xs font-bold text-[#38513e]">Investor <span aria-hidden="true">*</span><input required maxLength={120} value={draft.investor} onChange={e => set("investor",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Investor Email (optional)<input type="email" maxLength={160} value={draft.email} onChange={e => set("email",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Account Type<select value={draft.accountType} onChange={e => set("accountType",e.target.value as AccountType)} className={input}>{accountTypes.map(v => <option key={v}>{v}</option>)}</select></label>
    <label className="text-xs font-bold text-[#38513e]">Account Reference <span aria-hidden="true">*</span><input required maxLength={120} value={draft.accountReference} onChange={e => set("accountReference",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Transaction Type<select value={draft.type} onChange={e => set("type",e.target.value as TransactionType)} className={input}>{transactionTypes.map(v => <option key={v}>{v}</option>)}</select></label>
    <label className="text-xs font-bold text-[#38513e]">Amount (₦) <span aria-hidden="true">*</span><input required type="number" min="0.01" max="1000000000000" step="0.01" value={draft.amount} onChange={e => set("amount",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Transaction Status<select value={draft.status} onChange={e => set("status",e.target.value as TransactionStatus)} className={input}>{transactionStatuses.map(v => <option key={v}>{v}</option>)}</select></label>
    <label className="text-xs font-bold text-[#38513e]">Payment Method <span aria-hidden="true">*</span><input required maxLength={120} value={draft.paymentMethod} onChange={e => set("paymentMethod",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Transaction Date <span aria-hidden="true">*</span><input required type="date" value={draft.created} onChange={e => set("created",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Investment Reference (optional)<input maxLength={120} value={draft.investmentReference} onChange={e => set("investmentReference",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Purpose <span aria-hidden="true">*</span><input required maxLength={160} value={draft.purpose} onChange={e => set("purpose",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e]">Payment Reference (optional)<input maxLength={120} value={draft.paymentReference} onChange={e => set("paymentReference",e.target.value)} className={input}/></label>
    <label className="text-xs font-bold text-[#38513e] sm:col-span-2">Notes (optional)<textarea maxLength={1000} rows={3} value={draft.notes} onChange={e => set("notes",e.target.value)} className={input}/></label>
  </div><p className="mt-4 text-xs text-[#6a7b6f]">* Required. Changes remain in this browser's memory and reset on reload.</p>{error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} className={`rounded-md border border-star-200 px-4 py-2.5 text-xs font-bold text-star-700 ${focus}`}>Cancel</button><button type="submit" className={`rounded-md bg-star-900 px-4 py-2.5 text-xs font-bold text-white ${focus}`}>{item ? "Save Changes" : "Add Transaction"}</button></div></form></Dialog>;
}
