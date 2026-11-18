"use client";
import { useState } from "react";
import { CircleX, Clock3, ShieldCheck, Users } from "lucide-react";
import { AdminSectionCard, SummaryCards, UnavailableTable } from "./AdminDataStates";
import { UnavailableDetails } from "./UnavailableDetails";
import { KycFilters, KycStatusTabs, type KycFiltersState, type KycTab } from "./KycFilters";
export function AdminKycPage() {
 const [tab,setTab]=useState<KycTab>("all");const [filters,setFilters]=useState<KycFiltersState>({search:"",accountType:"All Types",status:"All Statuses",dateRange:"all",from:"",to:""});
 return <main className="mt-5"><SummaryCards items={[{title:"Total Accounts",icon:Users},{title:"Verified",icon:ShieldCheck},{title:"Pending Review",icon:Clock3},{title:"Rejected",icon:CircleX}]}/><AdminSectionCard className="mt-5 p-4"><p className="mb-3 text-xs text-[#738078]">KYC filters and details require an authorized read-only backend contract.</p><fieldset disabled aria-label="KYC filters unavailable" className="opacity-60"><KycStatusTabs value={tab} onChange={setTab}/><div className="mt-4"><KycFilters filters={filters} onChange={setFilters}/></div></fieldset></AdminSectionCard><div className="mt-4"><UnavailableTable title="KYC & Verification" columns={["Investor","Account Type","Date Submitted","Status"]} message="KYC records unavailable" actions={["View"]}/></div><div className="mt-4"><UnavailableDetails title="KYC Details" description="Select an authorized KYC record when read-only access is available."/></div></main>;
}
