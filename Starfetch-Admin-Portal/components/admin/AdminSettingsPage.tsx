"use client";

import { AdminStatCard } from "./AdminDashboard";
import { SettingsCategoriesGrid } from "./SettingsCategories";
import { AdminRolesCard, RecentConfigurationChanges, SystemStatusCard } from "./SettingsOverviewCards";
import { settingsSummaryStats } from "./admin-settings-data";

export function SettingsSummaryCards() {
  return <section aria-label="Settings summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{settingsSummaryStats.map(stat=><AdminStatCard key={stat.title} stat={stat}/>)}</section>;
}
export function AdminSettingsPage() {
  return <main className="mt-4"><p className="mb-1 text-[10px] font-semibold text-[#6f8073]">Development preview · All counts, security events, changes, integrations and statuses are synthetic.</p><p className="mb-4 text-[10px] text-[#7c897e]">No configuration is changed, no integrations are connected, and no infrastructure checks are performed.</p><SettingsSummaryCards/><div className="mt-5"><SettingsCategoriesGrid/></div><div className="mt-5 grid items-start gap-4 xl:grid-cols-3"><RecentConfigurationChanges/><AdminRolesCard/><SystemStatusCard/></div></main>;
}
