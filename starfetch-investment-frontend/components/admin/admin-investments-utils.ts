import type { AdminInvestment, InvestmentTab } from "./admin-investments-data";
import type { InvestmentFiltersState } from "./InvestmentFilters";

/** Operates exclusively on the synthetic sample and a fixed as-of date. */
export function filterInvestments(investments: AdminInvestment[], tab: InvestmentTab, filters: InvestmentFiltersState, snapshotDate: string): AdminInvestment[] {
  const query = filters.search.trim().toLowerCase();
  const end = new Date(`${snapshotDate}T00:00:00Z`);
  const start = new Date(end);
  if (filters.dateRange === "30") start.setUTCDate(start.getUTCDate() - 29);
  if (filters.dateRange === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  if (filters.dateRange === "6m") start.setUTCMonth(start.getUTCMonth() - 6);
  if (filters.dateRange === "12m") start.setUTCMonth(start.getUTCMonth() - 12);
  return investments.filter(item => {
    const matchesTab = tab === "all" || (tab === "fixed" && item.solution === "Starfetch Fixed Note") || (tab === "discretionary" && item.solution === "Discretionary Portfolio") || (tab === "execution" && item.solution === "Execution Mandate") || (tab === "pending" && item.status === "Pending Funding");
    const matchesSearch = !query || [item.investor, item.email, item.solution, item.series ?? "", `${item.solution} ${item.series ?? ""}`, item.reference, item.accountReference].some(value => value.toLowerCase().includes(query));
    const matchesType = filters.accountType === "All Types" || item.accountType === filters.accountType;
    const matchesStatus = filters.status === "All Statuses" || item.status === filters.status;
    let matchesDate = true;
    if (filters.dateRange === "custom") matchesDate = !!filters.from && !!filters.to && filters.from <= filters.to && item.startDate >= filters.from && item.startDate <= filters.to;
    else if (filters.dateRange !== "all") { const date = new Date(`${item.startDate}T00:00:00Z`); matchesDate = date >= start && date <= end; }
    return matchesTab && matchesSearch && matchesType && matchesStatus && matchesDate;
  });
}
