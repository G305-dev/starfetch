"use client";

import { useSyncExternalStore } from "react";
import { adminUsers, type AdminUser } from "./fixtures/admin-users-data";

// Shared, browser-memory-only demo registry. No backend, storage, or network calls.
// Every page reads the exact same snapshot; add/delete/reset notify all subscribers.
let currentUsers: AdminUser[] = adminUsers;
const subscribers = new Set<() => void>();

function subscribe(callback: () => void) {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}

export function getDemoUsers(): AdminUser[] { return currentUsers; }
export function getDemoUser(reference: string): AdminUser | undefined {
  return currentUsers.find(user => user.reference === reference);
}
export function setDemoUsers(next: AdminUser[]) {
  currentUsers = [...next];
  subscribers.forEach(notify => notify());
}
export function resetDemoUsers() { setDemoUsers(adminUsers); }
export function useDemoUsers(): AdminUser[] {
  return useSyncExternalStore(subscribe, getDemoUsers, () => adminUsers);
}

// The existing synthetic UI uses INV-* investor references but ACC-* account
// references in finance fixtures. Derive an account label for new demo records;
// authorization and lookup always use the exact registered investor reference.
export function accountReferenceForUser(user: AdminUser): string {
  return user.reference.startsWith("INV-")
    ? `ACC-${user.reference.slice(4)}`
    : `ACC-${user.reference}`;
}

export const USER_NOT_FOUND = "User not found. Please confirm that this investor has an account on Starfetch before adding an investment.";
export const TRANSACTION_USER_NOT_FOUND = "User not found. Please confirm that this user is registered on Starfetch before adding a transaction.";
