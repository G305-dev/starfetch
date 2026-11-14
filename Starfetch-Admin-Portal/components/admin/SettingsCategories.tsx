"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AdminSectionCard } from "./AdminDashboard";
import { settingsCategories, type SettingsCategory } from "./admin-settings-data";

export function SettingsCategoryCard({ category, selected, onSelect }: { category: SettingsCategory; selected: boolean; onSelect: () => void }) {
  const Icon = category.icon;
  return <article className="min-w-0 rounded-xl border border-[#e7ece7] bg-white shadow-[0_3px_12px_rgba(23,51,30,0.035)]"><button type="button" aria-expanded={selected} onClick={onSelect} className="flex min-h-[90px] w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f9fcf7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-star-700"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#edf9dc] text-[#0b5c29]"><Icon size={21}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold text-[#17271b]">{category.title}</span><span className="mt-1 block text-[10px] leading-relaxed text-[#617067]">{category.description}</span></span><ChevronRight size={16} className="shrink-0 text-[#3e5744]"/></button>{selected && <p role="status" className="mx-3 mb-3 rounded-md border border-[#cfe3c2] bg-[#f0f8e9] px-3 py-2 text-[10px] text-star-900">{category.title} is coming soon. No settings were changed.</p>}</article>;
}
export function SettingsCategoriesGrid() {
  const [selected,setSelected]=useState<string | null>(null);
  return <AdminSectionCard className="p-3 sm:p-4"><h2 className="text-[16px] font-extrabold tracking-[-.025em]">Settings Categories</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{settingsCategories.map(category=><SettingsCategoryCard key={category.title} category={category} selected={selected===category.title} onSelect={()=>setSelected(current=>current===category.title ? null : category.title)}/>)}</div></AdminSectionCard>;
}
