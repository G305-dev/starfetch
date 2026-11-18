"use client";
import { useState } from "react";
import { ArrowLeftRight, Coins, Hourglass, ShieldCheck } from "lucide-react";
import { AdminSectionCard, SummaryCards, UnavailableTable } from "./AdminDataStates";
import { UnavailableDetails } from "./UnavailableDetails";
import { TransactionFilters, TransactionTypeTabs, type TransactionFiltersState, type TransactionTab } from "./TransactionFilters";
export function AdminTransactionsPage() {
 const [tab,setTab]=useState<TransactionTab>("all");const [filters,setFilters]=useState<TransactionFiltersState>({search:"",type:"All Types",accountType:"All Types",status:"All Statuses",dateRange:"all",from:"",to:""});
 return <main className="mt-5"><SummaryCards items={[{title:"Total Transactions",icon:ArrowLeftRight},{title:"Pending Approvals",icon:Hourglass},{title:"Successful Transactions",icon:ShieldCheck},{title:"Total Transaction Value",icon:Coins}]}/><AdminSectionCard className="mt-5 p-4"><p className="mb-3 text-xs text-[#738078]">View and edit are unavailable until authorized transaction read and edit contracts are approved. No transaction fields can be changed.</p><fieldset disabled aria-label="Transaction filters unavailable" className="opacity-60"><TransactionTypeTabs value={tab} onChange={setTab}/><div className="mt-4"><TransactionFilters filters={filters} onChange={setFilters}/></div></fieldset></AdminSectionCard><div className="mt-4"><UnavailableTable title="Transactions" columns={["Transaction","Investor","Account Type","Type","Amount","Status","Date"]} message="Transaction data unavailable" actions={["View","Edit"]}/></div><div className="mt-4"><UnavailableDetails title="Transaction Details" description="View and edit require an authorized record and approved editable fields. No changes are allowed."/></div></main>;
}
