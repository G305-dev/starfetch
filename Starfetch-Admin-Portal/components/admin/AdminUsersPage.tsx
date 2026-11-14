"use client";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { AdminStatCard } from "./AdminDashboard";
import { AdminUsersFilters, type UserFilters } from "./AdminUsersFilters";
import { AdminUsersTable, type SortDirection, type SortKey } from "./AdminUsersTable";
import { InvestorDetailPanel } from "./InvestorDetailPanel";
import { AccountTypeBreakdown, RecentRegistrationsCard, VerificationQueueCard } from "./UsersOverviewCards";
import { adminUsers, mockSnapshotDate, usersSummary } from "./admin-users-data";
import { filterAndSortUsers } from "./admin-users-utils";

const initialFilters: UserFilters = { search: "", accountType: "All Types", accountStatus: "All Statuses", date: "30" };
export function AdminUsersPage() {
  const [filters, setFilters] = useState<UserFilters>(initialFilters);
  const [sortKey, setSortKey] = useState<SortKey>("joined");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pageSize, setPageSize] = useState(8);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>("INV-100234");
  const [checked, setChecked] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [displayRange, setDisplayRange] = useState("Nov 1, 2026 – Nov 2, 2026");
  const filtered = useMemo(() => filterAndSortUsers(adminUsers, filters, sortKey, sortDirection, mockSnapshotDate), [filters, sortKey, sortDirection]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selectedUser = filtered.find(user => user.reference === selected) ?? filtered[0] ?? null;
  const changeFilters = (next: UserFilters) => { setFilters(next); setPage(1); };
  const action = (name: string) => setNotice(`${name} is coming soon. No real action was performed.`);
  const onSort = (key: SortKey) => { if (key === sortKey) setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("asc"); } setPage(1); };
  const toggle = (reference: string) => setChecked(current => current.includes(reference) ? current.filter(item => item !== reference) : [...current, reference]);
  const togglePage = () => setChecked(current => rows.every(row => current.includes(row.reference)) ? current.filter(item => !rows.some(row => row.reference === item)) : Array.from(new Set([...current, ...rows.map(row => row.reference)])));
  const selectQueueUser = (reference: string) => { setFilters({ ...initialFilters, search: reference, date: "all" }); setSelected(reference); setPage(1); document.getElementById("users-directory")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const viewAll = () => { setFilters({ ...initialFilters, date: "all" }); setPage(1); document.getElementById("users-directory")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  return <main className="mt-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold text-[#6f8073]">Development preview · All accounts, values and activity are synthetic.</p><p className="mt-1 text-[10px] text-[#7c897e]">KPIs and breakdown are illustrative aggregates; the table contains a smaller sample. Date Joined filters use the Nov 2, 2026 mock snapshot. The header range is display-only.</p></div><label className="relative flex items-center gap-2 rounded-lg border border-[#dfe6df] bg-white px-3 py-2 text-[10px] font-bold text-[#26372b]"><CalendarDays size={15}/><span className="sr-only">Header date range (display only)</span><select value={displayRange} onChange={e => setDisplayRange(e.target.value)} className="appearance-none bg-transparent pr-5 outline-none focus-visible:ring-2 focus-visible:ring-star-700"><option>Nov 1, 2026 – Nov 2, 2026</option><option>Last 7 days</option><option>Last 30 days</option><option>Last 3 months</option></select><ChevronDown size={14} className="pointer-events-none absolute right-3"/></label></div>{notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#cfe3c2] bg-[#f0f8e9] px-4 py-3 text-xs text-star-900"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss message" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-star-700"><X size={16}/></button></div>}<section aria-label="User summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{usersSummary.map(stat => <AdminStatCard key={stat.title} stat={stat}/>)}</section><div id="users-directory" className="mt-5 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(270px,300px)]"><div className="min-w-0 space-y-4"><AdminUsersFilters filters={filters} onChange={changeFilters} onAction={action}/><AdminUsersTable rows={rows} selected={selectedUser?.reference ?? null} select={user => setSelected(user.reference)} checked={checked} toggle={toggle} togglePage={togglePage} sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} page={currentPage} pages={pages} setPage={setPage} pageSize={pageSize} setPageSize={size => { setPageSize(size); setPage(1); }} total={filtered.length} onAction={action}/></div><InvestorDetailPanel user={selectedUser} onAction={action}/></div><div className="mt-5 grid items-start gap-4 lg:grid-cols-3"><AccountTypeBreakdown/><RecentRegistrationsCard onSelect={selectQueueUser} onViewAll={viewAll}/><VerificationQueueCard onSelect={selectQueueUser} onViewAll={() => action("Verification queue")}/></div></main>;
}
