import type { AdminTransaction, TransactionTab } from "./admin-transactions-data";
import type { TransactionFiltersState } from "./TransactionFilters";

/** Filters only synthetic rows, anchored to the mock snapshot rather than a live backend. */
export function filterTransactions(transactions: AdminTransaction[], tab: TransactionTab, filters: TransactionFiltersState, snapshot: string): AdminTransaction[] {
  const query = filters.search.trim().toLowerCase();
  const end = new Date(`${snapshot}T00:00:00Z`);
  const start = new Date(end);
  if (filters.dateRange === "7") start.setUTCDate(start.getUTCDate() - 6);
  if (filters.dateRange === "30") start.setUTCDate(start.getUTCDate() - 29);
  if (filters.dateRange === "3m") start.setUTCMonth(start.getUTCMonth() - 3);
  return transactions.filter(item => {
    const matchesTab = tab === "all" || (tab === "deposits" && item.type === "Deposit") || (tab === "withdrawals" && item.type === "Withdrawal") || (tab === "funding" && item.type === "Investment Funding") || (tab === "redemptions" && item.type === "Redemption") || (tab === "failed" && (item.status === "Failed" || item.status === "Flagged"));
    const matchesSearch = !query || [item.id,item.investor,item.email,item.accountReference,item.investmentReference ?? "",item.detail.referenceNumber].some(value => value.toLowerCase().includes(query));
    const matchesType = filters.type === "All Types" || item.type === filters.type;
    const matchesAccount = filters.accountType === "All Types" || item.accountType === filters.accountType;
    const matchesStatus = filters.status === "All Statuses" || item.status === filters.status;
    let matchesDate = true;
    if (filters.dateRange === "custom") matchesDate = !!filters.from && !!filters.to && filters.from <= filters.to && item.created >= filters.from && item.created <= filters.to;
    else if (filters.dateRange !== "all") { const date = new Date(`${item.created}T00:00:00Z`); matchesDate = date >= start && date <= end; }
    return matchesTab && matchesSearch && matchesType && matchesAccount && matchesStatus && matchesDate;
  });
}
