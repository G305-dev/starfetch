"use client";

import { useId, useMemo } from "react";
import type { AdminUser } from "./fixtures/admin-users-data";

const control = "mt-1.5 min-h-10 w-full rounded-md border border-[#d8e2d8] bg-white px-3 py-2 text-sm text-star-900 outline-none focus:ring-2 focus:ring-star-700";

/** Accessible search + native dropdown: free text alone never identifies an investor. */
export function DemoInvestorPicker({ users, query, selectedReference, onQueryChange, onSelect, error }: {
  users: AdminUser[];
  query: string;
  selectedReference: string;
  onQueryChange: (query: string) => void;
  onSelect: (reference: string) => void;
  error?: string;
}) {
  const id = useId();
  const matches = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    return users.filter(user => !text || [user.name, user.reference, user.email].some(value => value.toLocaleLowerCase().includes(text)));
  }, [users, query]);
  return <div className="sm:col-span-2 space-y-2">
    <label htmlFor={`${id}-search`} className="block text-xs font-bold text-[#38513e]">Find Registered Investor <span aria-hidden="true">*</span>
      <input id={`${id}-search`} autoComplete="off" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search by name, email or investor reference" className={control}/>
    </label>
    <label htmlFor={`${id}-select`} className="block text-xs font-bold text-[#38513e]">Select Existing Account <span aria-hidden="true">*</span>
      <select id={`${id}-select`} required value={selectedReference} onChange={event => onSelect(event.target.value)} className={control} aria-invalid={Boolean(error)}>
        <option value="">Select a registered user</option>
        {matches.map(user => <option key={user.reference} value={user.reference}>{user.name} — {user.reference} ({user.accountType})</option>)}
      </select>
    </label>
    {query.trim() && matches.length === 0 && <p role="status" className="text-xs font-semibold text-red-700">User not found. No registered demo account matches your search.</p>}
    {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
    <p className="text-[10px] text-[#718075]">A registered demo account must be selected. Typing a name alone does not authorize saving.</p>
  </div>;
}
