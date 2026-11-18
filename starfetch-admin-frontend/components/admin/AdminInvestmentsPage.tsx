"use client";
import { useState } from "react";
import { CalendarDays, Layers3, ShieldCheck, WalletCards } from "lucide-react";
import { AdminSectionCard, SummaryCards, UnavailableTable } from "./AdminDataStates";
import { UnavailableDetails } from "./UnavailableDetails";
import { InvestmentFilters, InvestmentTabs, type InvestmentFiltersState, type InvestmentTab } from "./InvestmentFilters";
export function AdminInvestmentsPage() {
 const [tab,setTab]=useState<InvestmentTab>("all");const [filters,setFilters]=useState<InvestmentFiltersState>({search:"",accountType:"All Types",status:"All Statuses",dateRange:"all",from:"",to:""});
 return <main className="mt-5"><SummaryCards items={[{title:"Total Investments",icon:Layers3},{title:"Investment Value",icon:WalletCards},{title:"Active Investments",icon:ShieldCheck},{title:"Maturing Soon",icon:CalendarDays}]}/><AdminSectionCard className="mt-5 p-4"><p className="mb-3 text-xs text-[#738078]">Investment filters will be available after backend integration.</p><fieldset disabled aria-label="Investment filters unavailable" className="opacity-60"><InvestmentTabs value={tab} onChange={setTab}/><div className="mt-4"><InvestmentFilters filters={filters} onChange={setFilters}/></div></fieldset></AdminSectionCard><div className="mt-4"><UnavailableTable title="Investments" columns={["Investor","Product","Account Type","Amount Invested","Current Value","Status","Start Date","Maturity Date"]} message="Investment data unavailable" actions={["View"]}/></div><div className="mt-4"><UnavailableDetails title="Investment Details" description="Select an authorized investment record when read access is available."/></div></main>;
}
