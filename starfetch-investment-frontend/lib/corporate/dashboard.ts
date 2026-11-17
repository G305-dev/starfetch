import { getTimeGreeting } from "../greeting";
import type { CorporateApplicationState } from "./application";

/**
 * Corporate dashboard display rules (frontend only).
 *
 * - Heading: first-timers (account created < 24h ago) see
 *   "Welcome, {company}"; returning users (account >= 1 day old) see
 *   "Good morning/afternoon/evening, {company}" by local time.
 * - Verified badge: shown only when the backend application status is
 *   APPROVED (admin-verified). Email verification alone never shows it.
 * - Company identity always comes from the authenticated backend
 *   projections (user.companyName / onboarding details), never from
 *   frontend-entered values.
 */

const FIRST_TIMER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** True only for admin-approved Corporate applications. */
export function isCorporateVerified(status: CorporateApplicationState | null | undefined): boolean {
  return status === "APPROVED";
}

/**
 * True when the account was created within the last 24 hours.
 * Missing/invalid timestamps are treated as first-timer (safe default:
 * "Welcome" rather than a time greeting for a brand-new session).
 */
export function isCorporateFirstTimer(createdAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return true;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;
  return now.getTime() - created < FIRST_TIMER_WINDOW_MS;
}

/** Builds the dashboard heading, e.g. "Welcome, Acme Ltd" or "Good morning, Acme Ltd". */
export function getCorporateDashboardHeading(input: {
  companyName: string;
  createdAt: string | null | undefined;
  now?: Date;
}): string {
  const name = input.companyName.trim() || "Corporate applicant";
  const now = input.now ?? new Date();
  if (isCorporateFirstTimer(input.createdAt, now)) return `Welcome, ${name}`;
  return `${getTimeGreeting(now)}, ${name}`;
}

/** Avatar initials from a company name, e.g. "Greenfield Holdings Ltd" -> "GH". */
export function getCompanyInitials(companyName: string): string {
  const words = companyName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CA";
  const first = words[0]?.charAt(0) ?? "";
  const second = words[1]?.charAt(0) ?? words[0]?.charAt(1) ?? "";
  const initials = `${first}${second}`.toUpperCase();
  return initials || "CA";
}

/** Formats a date like the design, e.g. "Tue, 21 Jan 2025" (local time). */
export function formatCorporateDate(now: Date = new Date()): string {
  return now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** Ensures an RC number displays with the "RC" prefix, e.g. "RC 1634827". */
export function formatRcNumber(rcNumber: string | null | undefined): string {
  const value = (rcNumber ?? "").trim();
  if (!value) return "Not available";
  return /^rc\b/i.test(value) ? value : `RC ${value}`;
}
