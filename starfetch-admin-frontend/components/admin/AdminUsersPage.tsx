"use client";
import { useState } from "react";
import { Layers3, LockKeyhole, Shield, Users } from "lucide-react";
import { AdminSectionCard, SummaryCards, UnavailableTable } from "./AdminDataStates";
import { AdminUsersFilters, type UserFilters } from "./AdminUsersFilters";

export function AdminUsersPage() {
  const [filters,setFilters] = useState<UserFilters>({ search:"", accountType:"All Types", accountStatus:"All Statuses", date:"all" });
  return <main className="mt-5"><SummaryCards items={[{title:"Total Users",icon:Users},{title:"Active Accounts",icon:Layers3},{title:"Pending Verification",icon:Shield},{title:"Restricted Accounts",icon:LockKeyhole}]}/><AdminSectionCard className="mt-5 p-4"><h2 className="mb-3 text-[15px] font-extrabold">Users & Accounts</h2><p className="mb-3 text-xs text-[#738078]">Search and filters will be available when authorized user data is connected.</p><fieldset disabled aria-label="User filters unavailable" className="opacity-60"><AdminUsersFilters filters={filters} onChange={setFilters}/></fieldset></AdminSectionCard><div className="mt-4"><UnavailableTable title="Users" columns={["Investor","Account Type","Email","Account Status","Portfolio Value","Date Joined","Last Activity"]} message="User data unavailable"/></div></main>;
}
