/**
 * LOGIN DESTINATION CASES — declarative data only.
 *
 * V3 re-implemented the SignInForm submit decision and AuthProvider's
 * session-restore decision in this module and called that a runtime test. Those
 * copies are gone. The scenarios below are kept because the static check still
 * uses them as a table of expected destinations; the behaviour they describe is
 * executed against the REAL components in
 * provider-sync-runtime-check.tsx / login-return-path-runtime-check.tsx.
 */
import { createElement } from "react";

type Projection = { authorizedContexts?: Array<"INDIVIDUAL" | "JOINT" | "CORPORATE">; jointMembershipCount?: number };

export type LoginScenario = {
  name: string;
  accountType: "individual" | "joint" | "corporate";
  next: string | null;
  projection: Projection;
  expectDestination: string | null;
  expectNotice: boolean;
};

export const loginScenarios: LoginScenario[] = [
  { name: "Individual -> Individual", accountType: "individual", next: null, projection: { authorizedContexts: ["INDIVIDUAL"] }, expectDestination: "/dashboard", expectNotice: false },
  { name: "Corporate -> Corporate", accountType: "corporate", next: null, projection: { authorizedContexts: ["CORPORATE"] }, expectDestination: "/corporate/dashboard", expectNotice: false },
  { name: "Joint member -> Joint", accountType: "joint", next: null, projection: { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 }, expectDestination: "/joint/dashboard", expectNotice: false },
  { name: "Individual-only -> Corporate (blocked)", accountType: "corporate", next: null, projection: { authorizedContexts: ["INDIVIDUAL"] }, expectDestination: null, expectNotice: true },
  { name: "Individual-only -> Joint (blocked)", accountType: "joint", next: null, projection: { authorizedContexts: ["INDIVIDUAL"] }, expectDestination: null, expectNotice: true },
  { name: "Corporate-only -> Individual (blocked)", accountType: "individual", next: null, projection: { authorizedContexts: ["CORPORATE"] }, expectDestination: null, expectNotice: true },
  { name: "Corporate-only -> Joint (blocked)", accountType: "joint", next: null, projection: { authorizedContexts: ["CORPORATE"] }, expectDestination: null, expectNotice: true },
  { name: "Corporate-only -> protected Corporate return path", accountType: "corporate", next: "/corporate/profile", projection: { authorizedContexts: ["CORPORATE"] }, expectDestination: "/corporate/profile", expectNotice: false },
  { name: "Individual-only -> forged Corporate return path (blocked)", accountType: "corporate", next: "/corporate/profile", projection: { authorizedContexts: ["INDIVIDUAL"] }, expectDestination: null, expectNotice: true },
  { name: "Individual -> Joint application journey allowed", accountType: "joint", next: "/register/joint", projection: { authorizedContexts: ["INDIVIDUAL"] }, expectDestination: "/register/joint", expectNotice: false },
  { name: "Unverifiable projection (no authorizedContexts) blocked", accountType: "individual", next: null, projection: {}, expectDestination: null, expectNotice: true },
  { name: "Empty authorizedContexts blocked", accountType: "individual", next: null, projection: { authorizedContexts: [] }, expectDestination: null, expectNotice: true },
];

/**
 * SESSION RESTORE IS NO LONGER RE-DERIVED HERE.
 *
 * V3 duplicated AuthProvider's restore/session-end decisions in this file, which
 * could silently drift from the shipped provider. That matrix has been deleted:
 * the real AuthProvider is now mounted and exercised in
 * provider-sync-runtime-check.tsx (group "backend-confirmed session end during
 * refresh" plus every group's restore step), so the duplicated logic — and the
 * risk that came with it — no longer exists anywhere in this repository.
 */

export { createElement };
