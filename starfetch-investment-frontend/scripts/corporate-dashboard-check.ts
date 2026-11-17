import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatCorporateDate,
  formatRcNumber,
  getCompanyInitials,
  getCorporateDashboardHeading,
  isCorporateFirstTimer,
  isCorporateVerified,
} from "../lib/corporate/dashboard";

const root = process.cwd();
const dashboard = readFileSync(join(root, "components/corporate/CorporateDashboardContent.tsx"), "utf8");
const topbar = readFileSync(join(root, "components/corporate/CorporateTopbar.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

// Verified badge: only APPROVED (admin-verified).
expectEqual(isCorporateVerified("APPROVED"), true, "verified for APPROVED");
for (const status of ["DRAFT", "SUBMITTED", "IN_REVIEW", "INFO_REQUESTED", "REJECTED"] as const) {
  expectEqual(isCorporateVerified(status), false, `not verified for ${status}`);
}
expectEqual(isCorporateVerified(null), false, "not verified for null");
expectEqual(isCorporateVerified(undefined), false, "not verified for undefined");

// First-timer: created < 24h ago. Missing/invalid counts as first-timer.
const now = new Date(2026, 0, 22, 14, 0, 0);
expectEqual(isCorporateFirstTimer(new Date(now.getTime() - 60 * 60 * 1000).toISOString(), now), true, "first-timer 1h old");
expectEqual(isCorporateFirstTimer(new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(), now), true, "first-timer 23h old");
expectEqual(isCorporateFirstTimer(new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), now), false, "returning 25h old");
expectEqual(isCorporateFirstTimer(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), now), false, "returning 3d old");
expectEqual(isCorporateFirstTimer(null, now), true, "first-timer missing timestamp");
expectEqual(isCorporateFirstTimer("not-a-date", now), true, "first-timer invalid timestamp");

// Heading: Welcome for first-timers, time greeting after 1 day.
const recent = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
const old = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
expectEqual(getCorporateDashboardHeading({ companyName: "Greenfield Holdings Ltd", createdAt: recent, now }), "Welcome, Greenfield Holdings Ltd", "first-timer heading");
expectEqual(getCorporateDashboardHeading({ companyName: "Greenfield Holdings Ltd", createdAt: old, now: new Date(2026, 0, 22, 9, 0) }), "Good morning, Greenfield Holdings Ltd", "morning heading");
expectEqual(getCorporateDashboardHeading({ companyName: "Greenfield Holdings Ltd", createdAt: old, now: new Date(2026, 0, 22, 14, 0) }), "Good afternoon, Greenfield Holdings Ltd", "afternoon heading");
expectEqual(getCorporateDashboardHeading({ companyName: "Greenfield Holdings Ltd", createdAt: old, now: new Date(2026, 0, 22, 20, 0) }), "Good evening, Greenfield Holdings Ltd", "evening heading");
expectEqual(getCorporateDashboardHeading({ companyName: "  ", createdAt: recent, now }), "Welcome, Corporate applicant", "fallback company name");

// Initials, RC formatting, date formatting.
expectEqual(getCompanyInitials("Greenfield Holdings Ltd"), "GH", "initials GH");
expectEqual(getCompanyInitials("Acme"), "AC", "initials single word");
expectEqual(getCompanyInitials(""), "CA", "initials fallback");
expectEqual(formatRcNumber("1634827"), "RC 1634827", "RC prefix added");
expectEqual(formatRcNumber("RC 1634827"), "RC 1634827", "RC prefix kept");
expectEqual(formatRcNumber(null), "Not available", "RC missing");
const formattedDate = formatCorporateDate(new Date(2025, 0, 21));
assert(formattedDate.includes("21") && formattedDate.includes("Jan") && formattedDate.includes("2025"), `date format unexpected: ${formattedDate}`);

// Dashboard source checks.
assert(dashboard.includes("getCorporateDashboardHeading"), "Dashboard must use the first-timer/time heading helper");
assert(dashboard.includes("isCorporateVerified") && dashboard.includes("Verified Applicant"), "Dashboard must gate the Verified Applicant badge on approval");
assert(!dashboard.includes("Your corporate investment dashboard"), "Dashboard must omit the removed subtitle");
assert(dashboard.includes("Corporate Account Overview"), "Dashboard must render the account overview card");
assert(dashboard.includes("Portfolio Performance"), "Dashboard must render the portfolio performance card");
assert(dashboard.includes("CorporateApplicationsWorkspace"), "Dashboard must preserve the application/verification workspace");
assert(dashboard.includes("owner-scoped discovery API"), "Dashboard must describe portfolio availability via the owner-scoped discovery API");
for (const fake of ["4,285,600,000", "3,800,000,000", "485,600,000", "250,000,000", "Greenfield Holdings Ltd.", "1634827"]) {
  assert(!dashboard.includes(fake), `Dashboard must not contain example data: ${fake}`);
}

// Topbar source checks: company dropdown with Profile + Sign out.
assert(topbar.includes('aria-haspopup="menu"'), "Topbar company control must be a menu button");
assert(topbar.includes('href="/corporate/profile"') && topbar.includes("Profile"), "Topbar menu must link to Profile");
assert(topbar.includes("Sign out") && topbar.includes("logout"), "Topbar menu must offer Sign out via logout");
assert(topbar.includes("getCompanyInitials"), "Topbar avatar must use company initials");

console.log("PASS — Corporate dashboard uses Welcome/time greeting by account age, Verified Applicant only when APPROVED, no subtitle or example data, and a Profile/Sign out dropdown");
