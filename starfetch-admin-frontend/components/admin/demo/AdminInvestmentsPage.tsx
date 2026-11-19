"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminInvestmentsTable } from "./AdminInvestmentsTable";
import { InvestmentFilters, InvestmentTabs, type InvestmentFiltersState } from "./InvestmentFilters";
import { InvestmentEditDialog, InvestmentViewDialog } from "./InvestmentDemoDialogs";
import { AddInvestmentDialog } from "./AddInvestmentDialog";
import { getDemoUser } from "./demo-user-registry";
import { adminInvestments, investmentSnapshotDate, investmentSummaryStats, type AdminInvestment, type InvestmentTab } from "./fixtures/admin-investments-data";
import { filterInvestments } from "./admin-investments-utils";
const initialFilters: InvestmentFiltersState = { search:"", accountType:"All Types", status:"All Statuses", dateRange:"all", from:"", to:"" };
let sessionInvestments: AdminInvestment[] | null = null;
function nextDemoInvestmentReference(records: AdminInvestment[]): string {
 let number = 1;
 while (records.some(item => item.reference === `INVST-DEMO-${String(number).padStart(4, "0")}`)) number++;
 return `INVST-DEMO-${String(number).padStart(4, "0")}`;
}
export function InvestmentSummaryCards() { return <section aria-label="Investment summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{investmentSummaryStats.filter(stat => stat.title !== "Maturing Soon").map(stat => <AdminStatCard key={stat.title} stat={stat}/>)}</section>; }
export function AdminInvestmentsPage() {
 const [records,setRecords]=useState<AdminInvestment[]>(() => typeof window !== "undefined" && sessionInvestments ? sessionInvestments : adminInvestments);
 const [tab,setTab]=useState<InvestmentTab>("all"); const [filters,setFilters]=useState<InvestmentFiltersState>(initialFilters); const [page,setPage]=useState(1); const [notice,setNotice]=useState(""); const [dialog,setDialog]=useState<{kind:"add";trigger:HTMLElement}|{kind:"view" | "edit"; reference:string; trigger:HTMLElement}|null>(null);
 const filtered=useMemo(()=>filterInvestments(records,tab,filters,investmentSnapshotDate),[records,tab,filters]); const pages=Math.max(1,Math.ceil(filtered.length/10)); const currentPage=Math.min(page,pages); const rows=filtered.slice((currentPage-1)*10,currentPage*10); const item=records.find(row=>row.reference===(dialog && dialog.kind!=="add" ? dialog.reference : undefined));
 function save(changed:AdminInvestment) { const next=records.map(row=>row.reference===changed.reference?changed:row); sessionInvestments=next; setRecords(next); if (!filterInvestments([changed],tab,filters,investmentSnapshotDate).length) {setTab("all");setFilters(initialFilters);setPage(Math.floor(next.findIndex(row=>row.reference===changed.reference)/10)+1);} setDialog(null);setNotice(`Demo investment ${changed.reference} updated. No real investment, funding, balance or ledger action was performed.`); }
 function add(record: AdminInvestment) {
  if (!record.investorReference || !getDemoUser(record.investorReference)) {
    setNotice("User not found. The investment was not created. Please choose an existing demo investor.");
    return;
  }
  const next = [record, ...records];
  sessionInvestments = next;
  setRecords(next);
  setTab("all");setFilters(initialFilters);setPage(1);setDialog(null);
  setNotice(`Demo investment ${record.reference} added for ${record.investor}. No real investment, funding, balance or ledger action was performed.`);
 }
 function reset() {sessionInvestments=null;setRecords(adminInvestments);setTab("all");setFilters(initialFilters);setPage(1);setNotice("Investment demo changes reset to synthetic fixtures.");}
 return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Private demo · All investment records, financial values and activity are synthetic.</p><p className="mb-4 text-[10px] text-[#7c897e]">KPI and tab totals are illustrative aggregates, not the sample count. Start-date filters use the Nov 2, 2026 mock snapshot. Changes reset on reload.</p>{notice && <p role="status" className="mb-4 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900">{notice}</p>}<InvestmentSummaryCards/><div className="mt-5 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><InvestmentTabs value={tab} onChange={value=>{setTab(value);setPage(1);}}/><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={e=>setDialog({kind:"add",trigger:e.currentTarget})} className="inline-flex items-center gap-2 rounded-md bg-star-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-star-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-700"><Plus size={15} aria-hidden="true"/>Add Investment</button><button type="button" onClick={reset} className="rounded-md border border-star-200 px-3 py-2 text-xs font-bold text-star-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700">Reset Investment demo changes</button></div></div><InvestmentFilters filters={filters} onChange={value=>{setFilters(value);setPage(1);}}/><AdminInvestmentsTable rows={rows} onView={(row,trigger)=>setDialog({kind:"view",reference:row.reference,trigger})} onEdit={(row,trigger)=>setDialog({kind:"edit",reference:row.reference,trigger})} page={currentPage} pages={pages} setPage={setPage} total={filtered.length}/></div>{dialog?.kind==="add" && <AddInvestmentDialog trigger={dialog.trigger} close={()=>setDialog(null)} nextReference={nextDemoInvestmentReference(records)} save={add}/>} {item && dialog?.kind==="view" && <InvestmentViewDialog item={item} trigger={dialog.trigger} close={()=>setDialog(null)}/>}{item && dialog?.kind==="edit" && <InvestmentEditDialog item={item} trigger={dialog.trigger} close={()=>setDialog(null)} save={save}/>}</main>;
}
