"use client";
import { Layers3, Settings, Shield, Users } from "lucide-react";
import { AdminSectionCard, DataState, SummaryCards } from "./AdminDataStates";
import { SettingsCategoriesGrid } from "./SettingsCategories";
export function AdminSettingsPage() {
 return <main className="mt-5"><SummaryCards items={[{title:"Admin Users",icon:Users},{title:"Security Events",icon:Shield},{title:"Active Integrations",icon:Layers3},{title:"System Uptime",icon:Settings}]}/><div className="mt-5"><SettingsCategoriesGrid/></div><div className="mt-5 grid gap-4 xl:grid-cols-3">{["Recent Configuration Changes","Admin Users & Roles","System Status"].map(title=><AdminSectionCard key={title} className="p-4"><h2 className="text-[15px] font-extrabold">{title}</h2><DataState state="unavailable" title={`${title} unavailable`}/></AdminSectionCard>)}</div></main>;
}
