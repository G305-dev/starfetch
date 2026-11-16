import type { AdminUser } from "./admin-users-data";
import type { UserFilters } from "./AdminUsersFilters";
import type { SortDirection, SortKey } from "./AdminUsersTable";

// Filtering is anchored to a fixed mock snapshot, not the real system clock.
export function filterAndSortUsers(users: AdminUser[], filters: UserFilters, sortKey: SortKey, direction: SortDirection, snapshot: string): AdminUser[] {
  const end = new Date(`${snapshot}T00:00:00Z`);
  const start = new Date(end);
  if (filters.date === "7") start.setUTCDate(start.getUTCDate() - 6);
  if (filters.date === "30") start.setUTCDate(start.getUTCDate() - 29);
  if (filters.date === "90") start.setUTCMonth(start.getUTCMonth() - 3);
  const query = filters.search.trim().toLowerCase();
  const result = users.filter(user => {
    const matchesSearch = !query || [user.name, user.email, user.reference].some(value => value.toLowerCase().includes(query));
    const matchesType = filters.accountType === "All Types" || user.accountType === filters.accountType;
    const matchesStatus = filters.accountStatus === "All Statuses" || user.accountStatus === filters.accountStatus;
    const date = new Date(`${user.joined}T00:00:00Z`);
    const matchesDate = filters.date === "all" || (date >= start && date <= end);
    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });
  const activityMinutes = (value: string) => { const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value); if (!match) return 0; return (Number(match[1]) % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(match[2]); };
  return result.sort((a, b) => {
    const left = sortKey === "lastActivity" ? activityMinutes(a.lastActivity) : a[sortKey];
    const right = sortKey === "lastActivity" ? activityMinutes(b.lastActivity) : b[sortKey];
    const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
    return comparison * (direction === "asc" ? 1 : -1);
  });
}
