"use client";

import { Layers3, ShieldCheck, Users, ArrowLeftRight } from "lucide-react";
import { AdminSectionCard, DataState, SummaryCards } from "./AdminDataStates";

export function AdminDashboard() {
  return <main className="mt-5"><SummaryCards items={[{title:"Total Investors",icon:Users},{title:"Verified Investors",icon:ShieldCheck},{title:"Total AUM",icon:Layers3},{title:"Total Transactions",icon:ArrowLeftRight}]}/>
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"><AdminSectionCard className="p-4 sm:p-5"><h2 className="text-[15px] font-extrabold">Assets Under Management (AUM)</h2><p className="mt-2 text-3xl font-extrabold">—</p><div className="grid gap-4 sm:grid-cols-2"><DataState state="unavailable" title="Portfolio chart unavailable"/><div><h3 className="mt-5 text-xs font-bold text-[#536359]">Asset Allocation</h3><DataState state="unavailable" title="Allocation unavailable"/></div></div></AdminSectionCard><AdminSectionCard className="p-4"><h2 className="text-[15px] font-extrabold">Pending Actions</h2><DataState state="unavailable" title="Pending actions unavailable"/></AdminSectionCard></div>
    <div className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]"><AdminSectionCard className="p-4"><h2 className="text-[15px] font-extrabold">Recent Registrations</h2><DataState state="unavailable" title="Registrations unavailable"/></AdminSectionCard><AdminSectionCard className="p-4"><h2 className="text-[15px] font-extrabold">Recent System Activity</h2><DataState state="unavailable" title="Activity unavailable"/></AdminSectionCard></div>
    <AdminSectionCard className="mt-4 p-4"><h2 className="text-[15px] font-extrabold">Quick Actions</h2><p className="mt-2 text-xs text-[#738078]">Actions are unavailable until authorized backend operations are approved.</p><div className="mt-3 flex flex-wrap gap-2">{["Add Investor", "Record Investment", "Record Transaction", "Send Notification"].map(label => <button key={label} type="button" disabled className="rounded-md border border-[#dce7db] px-3 py-2 text-xs font-bold text-[#738078] disabled:cursor-not-allowed disabled:opacity-60">{label}</button>)}</div></AdminSectionCard>
  </main>;
}
