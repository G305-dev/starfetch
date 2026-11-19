"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DemoModal, demoButton } from "./DemoModal";
import { AddDemoUserDialog, DeleteDemoUserDialog } from "./DemoUserDialogs";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminUsersFilters, type UserFilters } from "./AdminUsersFilters";
import { AdminUsersTable, type SortDirection, type SortKey } from "./AdminUsersTable";
import { InvestorDetailPanel } from "./InvestorDetailPanel";
import { AccountTypeBreakdown, RecentRegistrationsCard, VerificationQueueCard } from "./UsersOverviewCards";
import { adminUsers, mockSnapshotDate, usersSummary, type AdminUser, type DemoUserDetails } from "./fixtures/admin-users-data";
import type { AccountType } from "./fixtures/admin-dashboard-data";
import type { AccountStatus } from "./AdminBadges";
import { filterAndSortUsers } from "./admin-users-utils";
import { useDemoUsers, setDemoUsers, resetDemoUsers } from "./demo-user-registry";

const initialFilters: UserFilters = { search:"", accountType:"All Types", accountStatus:"All Statuses", date:"30" };
let nextNumber = 1;
function nextReference(records: AdminUser[]) { let reference:string; do { reference=`INV-DEMO-${String(nextNumber++).padStart(4,"0")}`; } while(records.some(user=>user.reference===reference)); return reference; }
export function AdminUsersPage() {
 const router=useRouter();
 const records=useDemoUsers(); const setRecords=setDemoUsers;
 const [filters,setFilters]=useState<UserFilters>(initialFilters); const [sortKey,setSortKey]=useState<SortKey>("joined"); const [sortDirection,setSortDirection]=useState<SortDirection>("desc"); const [pageSize,setPageSize]=useState(8); const [page,setPage]=useState(1); const [notice,setNotice]=useState(""); const [displayRange,setDisplayRange]=useState("Nov 1, 2026 – Nov 2, 2026");
 const [dialog,setDialog]=useState<{kind:"add";trigger:HTMLElement}|{kind:"view"|"delete";reference:string;trigger:HTMLElement}|null>(null);
 const filtered=useMemo(()=>filterAndSortUsers(records,filters,sortKey,sortDirection,mockSnapshotDate),[records,filters,sortKey,sortDirection]);
 const pages=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,pages),rows=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);
 const selected=dialog && dialog.kind!=="add" ? records.find(user=>user.reference===dialog.reference) : undefined;
 const changeFilters=(next:UserFilters)=>{setFilters(next);setPage(1);};
 const action=(name:string)=>setNotice(`${name} is coming soon. No real action was performed.`);
 const onSort=(key:SortKey)=>{if(key===sortKey)setSortDirection(sortDirection==="asc"?"desc":"asc");else{setSortKey(key);setSortDirection("asc");}setPage(1);};
 const selectQueueUser=(reference:string)=>{setFilters({...initialFilters,search:reference,date:"all"});setPage(1);document.getElementById("users-directory")?.scrollIntoView({behavior:"smooth",block:"start"});};
 const viewAll=()=>{setFilters({...initialFilters,date:"all"});setPage(1);document.getElementById("users-directory")?.scrollIntoView({behavior:"smooth",block:"start"});};
 const openVerification=(reference:string)=>router.push(`/admin/kyc?investor=${encodeURIComponent(reference)}`);
 function save(type:AccountType,status:AccountStatus,details:DemoUserDetails){
  const primary=[details.primary.firstName,details.primary.middleName,details.primary.surname].filter(Boolean).join(" ");
  const secondary=details.secondary ? [details.secondary.firstName,details.secondary.middleName,details.secondary.surname].filter(Boolean).join(" ") : "";
  const name=type==="Corporate" ? details.companyName ?? primary : secondary ? `${primary} & ${secondary}` : primary;
  const user:AdminUser={name,reference:nextReference(records),accountType:type,email:details.primary.email,verification:"Pending",accountStatus:status,portfolio:0,joined:mockSnapshotDate,lastActivity:"New demo record",phone:details.primary.phone,location:"Not provided in demo",onboardingProgress:0,onboardingStages:[false,false,false,false],demoDetails:details};
  const next=[user,...records];setRecords(next);setFilters({...initialFilters,date:"all"});setSortKey("joined");setSortDirection("desc");setPage(1);setDialog(null);setNotice(`Synthetic user ${user.name} (${user.reference}) added with Pending verification. No real account was created.`);
 }
 function remove(user:AdminUser){const next=records.filter(record=>record.reference!==user.reference);setRecords(next);setDialog(null);setNotice(`Synthetic user ${user.name} (${user.reference}) deleted from demo only. No real customer was deleted.`);}
 function reset(){resetDemoUsers();setFilters(initialFilters);setSortKey("joined");setSortDirection("desc");setPage(1);setNotice("User demo changes reset to the original synthetic fixtures.");}
 return <main className="mt-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold text-[#6f8073]">Private demo · All accounts, values and activity are synthetic. Never enter real customer information.</p><p className="mt-1 text-[10px] text-[#7c897e]">KPIs and breakdown are illustrative aggregates; the table contains a smaller sample. Date filters use the Nov 2, 2026 mock snapshot. Changes reset on reload.</p></div><label className="relative flex items-center gap-2 rounded-lg border border-[#dfe6df] bg-white px-3 py-2 text-[10px] font-bold text-[#26372b]"><CalendarDays size={15}/><span className="sr-only">Header date range (display only)</span><select value={displayRange} onChange={e=>setDisplayRange(e.target.value)} className="appearance-none bg-transparent pr-5 outline-none focus-visible:ring-2 focus-visible:ring-star-700"><option>Nov 1, 2026 – Nov 2, 2026</option><option>Last 7 days</option><option>Last 30 days</option><option>Last 3 months</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3"/></label></div>{notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={()=>setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}<section aria-label="User summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{usersSummary.map(stat=><AdminStatCard key={stat.title} stat={stat}/>)}</section><div id="users-directory" className="mt-5"><div className="min-w-0 space-y-4"><AdminUsersFilters filters={filters} onChange={changeFilters} onAction={action} onAdd={trigger=>setDialog({kind:"add",trigger})}/><div className="flex justify-end"><button type="button" onClick={reset} className="rounded-md border border-star-200 px-3 py-2 text-xs font-bold text-star-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700">Reset Demo Changes</button></div><AdminUsersTable rows={rows} select={(user,trigger)=>setDialog({kind:"view",reference:user.reference,trigger})} onDelete={(user,trigger)=>setDialog({kind:"delete",reference:user.reference,trigger})} sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} page={currentPage} pages={pages} setPage={setPage} pageSize={pageSize} setPageSize={size=>{setPageSize(size);setPage(1);}} total={filtered.length}/></div></div><div className="mt-5 grid items-start gap-4 lg:grid-cols-3"><AccountTypeBreakdown/><RecentRegistrationsCard users={records} onSelect={selectQueueUser} onViewAll={viewAll}/><VerificationQueueCard users={records} onSelect={openVerification} onViewAll={()=>router.push("/admin/kyc")}/></div>{dialog?.kind==="add" && <AddDemoUserDialog trigger={dialog.trigger} users={records} close={()=>setDialog(null)} save={save}/>}{dialog?.kind==="view" && selected && <DemoModal title="Investor Profile" trigger={dialog.trigger} onClose={()=>setDialog(null)}><InvestorDetailPanel user={selected}/><div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>openVerification(selected.reference)} className={`${demoButton} border border-star-700 text-star-900`}>View Verification</button><button type="button" onClick={()=>setDialog(null)} className={`${demoButton} bg-star-900 text-white`}>Close</button></div></DemoModal>}{dialog?.kind==="delete" && selected && <DeleteDemoUserDialog user={selected} trigger={dialog.trigger} close={()=>setDialog(null)} confirm={()=>remove(selected)}/>}</main>;
}
