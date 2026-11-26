import type { Permission } from "@/lib/admin-api/contracts";

/**
 * PROPOSED gateway routes — declared here, never served.
 *
 * This lives outside `app/api/.../route.ts` because a Next.js route file may only
 * export handlers; anything else fails the build. Keeping the declaration in
 * `lib/` also means the contract and its permission are importable by tests and
 * documentation without pulling in a route handler.
 */

export type RouteDef = { method: "GET" | "POST" | "PATCH"; pattern: RegExp; permission: Permission };
export type ProposedRoute = RouteDef & { brief: number; contract: string };

/*
 * PROPOSED routes for the eleven expanded sections.
 *
 * These are declared so the contract and the permission for each operation live
 * beside the code that will call them, and so the eventual activation is a
 * one-line change per route rather than a redesign. They are NOT in the active
 * allowlist below and are NOT reachable: `PROPOSED_ROUTES_ENABLED` must stay
 * false until David approves and implements each contract. Enabling them early
 * would forward staff requests to endpoints that do not exist, and — worse —
 * would document an authorization decision that no backend confirms.
 *
 * The type is deliberately a superset of RouteDef so a test can assert every
 * proposed route carries an explicit approval marker.
 */
export const PROPOSED_ROUTES:ProposedRoute[]=[
 {method:'GET',pattern:/^\/approvals$/,permission:'approvals.read',brief:10,contract:'GET /api/v1/admin/approvals'},
 {method:'GET',pattern:/^\/approvals\/[a-f0-9-]{36}$/,permission:'approvals.read',brief:10,contract:'GET /api/v1/admin/approvals/:id'},
 {method:'GET',pattern:/^\/documents$/,permission:'documents.read',brief:14,contract:'GET /api/v1/admin/documents'},
 {method:'GET',pattern:/^\/support\/tickets$/,permission:'support.read',brief:15,contract:'GET /api/v1/admin/support/tickets'},
 {method:'GET',pattern:/^\/products$/,permission:'products.read',brief:7,contract:'GET /api/v1/admin/products'},
 {method:'GET',pattern:/^\/maturities$/,permission:'maturities.read',brief:11,contract:'GET /api/v1/admin/maturities'},
 {method:'GET',pattern:/^\/finance\/ledger$/,permission:'finance.read',brief:12,contract:'GET /api/v1/admin/finance/ledger'},
 {method:'GET',pattern:/^\/finance\/reconciliation$/,permission:'finance.read',brief:12,contract:'GET /api/v1/admin/finance/reconciliation'},
 {method:'GET',pattern:/^\/reports\/catalogue$/,permission:'reports.read',brief:13,contract:'GET /api/v1/admin/reports/catalogue'},
 {method:'GET',pattern:/^\/campaigns$/,permission:'campaigns.read',brief:8,contract:'GET /api/v1/admin/campaigns'},
 {method:'GET',pattern:/^\/notifications\/templates$/,permission:'notifications.templates.manage',brief:9,contract:'GET /api/v1/admin/notifications/templates'},
 {method:'GET',pattern:/^\/staff$/,permission:'staff.read',brief:16,contract:'GET /api/v1/admin/staff'},
 {method:'GET',pattern:/^\/audit-logs$/,permission:'audit.read',brief:17,contract:'GET /api/v1/admin/audit-logs'},
 {method:'GET',pattern:/^\/security\/monitor$/,permission:'security.monitor.read',brief:17,contract:'GET /api/v1/admin/security/monitor'},
 {method:'GET',pattern:/^\/settings\/integration-status$/,permission:'settings.integration.read',brief:18,contract:'GET /api/v1/admin/settings/integration-status'},
];
/**
 * Hard off switch for every proposed route. Default false, and it must remain
 * false in every environment until David signs the contracts off. There is no
 * environment variable that can enable it — that is intentional, because an env
 * flag is exactly the kind of thing that gets enabled "just to test" on prod.
 */
export const PROPOSED_ROUTES_ENABLED = false;

/** Returns a proposed route only when activation has been explicitly approved. */
export function matchProposedRoute(method: string, path: string): ProposedRoute | undefined {
  if (!PROPOSED_ROUTES_ENABLED) return undefined;
  return PROPOSED_ROUTES.find((route) => route.method === method && route.pattern.test(path));
}
