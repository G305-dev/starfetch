import type { KycInvestor, KycTab } from "./admin-kyc-data";
import type { KycFiltersState } from "./KycFilters";

/** Filters only synthetic rows, with a fixed as-of date instead of a live backend. */
export function filterKycInvestors(investors: KycInvestor[], tab: KycTab, filters: KycFiltersState, snapshot: string): KycInvestor[] {
  const query = filters.search.trim().toLowerCase();
  const end = new Date(`${snapshot}T00:00:00Z`);
  const start = new Date(end);
  if (filters.dateRange === "7") start.setUTCDate(start.getUTCDate() - 6);
  if (filters.dateRange === "30") start.setUTCDate(start.getUTCDate() - 29);
  if (filters.dateRange === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  return investors.filter(item => {
    const matchesTab = tab === "all" || (tab === "pending" && item.status === "Pending Review") || (tab === "verified" && item.status === "Verified") || (tab === "rejected" && item.status === "Rejected");
    const matchesSearch = !query || [item.name,item.email,item.reference,item.accountReference].some(value => value.toLowerCase().includes(query));
    const matchesType = filters.accountType === "All Types" || item.accountType === filters.accountType;
    const matchesStatus = filters.status === "All Statuses" || item.status === filters.status;
    let matchesDate = true;
    if (filters.dateRange === "custom") matchesDate = !!filters.from && !!filters.to && filters.from <= filters.to && item.submitted >= filters.from && item.submitted <= filters.to;
    else if (filters.dateRange !== "all") { const date = new Date(`${item.submitted}T00:00:00Z`); matchesDate = date >= start && date <= end; }
    return matchesTab && matchesSearch && matchesType && matchesStatus && matchesDate;
  });
}
