import { PERMISSIONS } from "../admin-api/contracts";

/**
 * ADMIN NAVIGATION TAXONOMY — one declaration for the whole portal.
 *
 * 18 functional sections is too many for a flat sidebar, so they are grouped into
 * six areas. This is the information architecture the brief proposes; it is a
 * single source of truth used by:
 *
 *   - the sidebar (`AdminShell`), which filters by staff permission,
 *   - the route inventory in `ADMIN_FRONTEND_CONSOLIDATION_REPORT.md`,
 *   - the integration-pending banner logic.
 *
 * `status` records implementation truth, and it is NOT decorative:
 *
 *   "live"               an existing page connected to the approved gateway.
 *   "integration-pending" the page renders honestly but has no approved backend
 *                         contract yet, so every action is disabled and it says so.
 *
 * A page marked "integration-pending" must never present an action as if it
 * worked. The sidebar shows the section (staff need to see the shape of the
 * portal), and the page itself is explicit about what is missing.
 */
export type SectionStatus = "live" | "integration-pending";

/** The icon set the sidebar knows how to render. */
export type AdminIconKey =
  | "dashboard" | "approvals" | "users" | "kyc" | "documents" | "support"
  | "investments" | "portfolios" | "products" | "maturities"
  | "transactions" | "finance" | "reports"
  | "campaigns" | "notifications"
  | "staff" | "audit" | "settings";

export type AdminNavItem = {
  key: string;
  label: string;
  href: string;
  /**
   * Icon KEY, not a component. Keeping this as a string means the taxonomy is
   * pure data — importable by tests and by the contract documentation without
   * pulling React or an icon library into a Node process. The sidebar owns the
   * key -> component mapping (components/admin/AdminShell.tsx).
   */
  icon: AdminIconKey;
  /** Permission required to SEE the item. The backend still authorizes the request. */
  permission: string;
  status: SectionStatus;
  /** One line, shown in the page header and the route inventory. */
  description: string;
  /** The brief's numbered section, for traceability to ADMIN_PORTAL_FUNCTIONAL_SCOPE.md. */
  briefSection: number;
};

export type AdminNavGroup = {
  key: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    key: "overview",
    label: "Overview",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/admin/dashboard",
        icon: "dashboard",
        permission: PERMISSIONS.dashboard,
        status: "live",
        description: "Operational overview from authorized backend records.",
        briefSection: 1,
      },
      {
        key: "approvals",
        label: "Approval Center",
        href: "/admin/approvals",
        icon: "approvals",
        permission: PERMISSIONS.approvalsRead,
        status: "integration-pending",
        description: "Centralized queue for every request awaiting independent approval.",
        briefSection: 10,
      },
    ],
  },
  {
    key: "investor-operations",
    label: "Investor Operations",
    items: [
      {
        key: "users",
        label: "Investor & Accounts",
        href: "/admin/users",
        icon: "users",
        permission: PERMISSIONS.investors,
        status: "live",
        description: "Manage registered investor accounts and invitations.",
        briefSection: 2,
      },
      {
        key: "kyc",
        label: "KYC & Compliance",
        href: "/admin/kyc",
        icon: "kyc",
        permission: PERMISSIONS.kyc,
        status: "live",
        description: "Review submissions under compliance controls.",
        briefSection: 3,
      },
      {
        key: "documents",
        label: "Document Management",
        href: "/admin/documents",
        icon: "documents",
        permission: PERMISSIONS.documentsRead,
        status: "integration-pending",
        description: "Secure document workspace with authorized access and audit history.",
        briefSection: 14,
      },
      {
        key: "support",
        label: "Support & Complaints",
        href: "/admin/support",
        icon: "support",
        permission: PERMISSIONS.supportRead,
        status: "integration-pending",
        description: "Investor enquiries and the complaints register.",
        briefSection: 15,
      },
    ],
  },
  {
    key: "investment-operations",
    label: "Investment Operations",
    items: [
      {
        key: "investments",
        label: "Investments",
        href: "/admin/investments",
        icon: "investments",
        permission: PERMISSIONS.investments,
        status: "live",
        description: "Investment positions and controlled instruction requests.",
        briefSection: 4,
      },
      {
        key: "portfolios",
        label: "Portfolios",
        href: "/admin/portfolios",
        icon: "portfolios",
        permission: PERMISSIONS.portfolios,
        status: "live",
        description: "Investment-solution totals from the valuation service.",
        briefSection: 6,
      },
      {
        key: "products",
        label: "Products",
        href: "/admin/products",
        icon: "products",
        permission: PERMISSIONS.productsRead,
        status: "integration-pending",
        description: "Product lifecycle from draft to publication.",
        briefSection: 7,
      },
      {
        key: "maturities",
        label: "Maturity & Redemption",
        href: "/admin/maturities",
        icon: "maturities",
        permission: PERMISSIONS.maturitiesRead,
        status: "integration-pending",
        description: "Upcoming, due and overdue maturities, redemptions and rollovers.",
        briefSection: 11,
      },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      {
        key: "transactions",
        label: "Transactions",
        href: "/admin/transactions",
        icon: "transactions",
        permission: PERMISSIONS.transactions,
        status: "live",
        description: "Reconciled transaction records and requests.",
        briefSection: 5,
      },
      {
        key: "finance",
        label: "Finance & Reconciliation",
        href: "/admin/finance",
        icon: "finance",
        permission: PERMISSIONS.financeRead,
        status: "integration-pending",
        description: "Posted ledger records, bank reconciliation and settlement batches.",
        briefSection: 12,
      },
      {
        key: "reports",
        label: "Reports & Statements",
        href: "/admin/reports",
        icon: "reports",
        permission: PERMISSIONS.reportsRead,
        status: "integration-pending",
        description: "Authorized report and statement generation.",
        briefSection: 13,
      },
    ],
  },
  {
    key: "communications",
    label: "Communications",
    items: [
      {
        key: "campaigns",
        label: "Campaigns",
        href: "/admin/campaigns",
        icon: "campaigns",
        permission: PERMISSIONS.campaignsRead,
        status: "integration-pending",
        description: "Approved marketing campaigns and their publication.",
        briefSection: 8,
      },
      {
        key: "notifications",
        label: "Notification Center",
        href: "/admin/notifications",
        icon: "notifications",
        permission: PERMISSIONS.notificationsRead,
        status: "integration-pending",
        description: "Manual and automated notifications, templates and delivery history.",
        briefSection: 9,
      },
    ],
  },
  {
    key: "administration",
    label: "Administration",
    items: [
      {
        key: "staff",
        label: "Staff & Permissions",
        href: "/admin/staff",
        icon: "staff",
        permission: PERMISSIONS.staffRead,
        status: "integration-pending",
        description: "Staff records, role assignment, sessions and offboarding.",
        briefSection: 16,
      },
      {
        key: "audit-logs",
        label: "Audit & Security",
        href: "/admin/audit-logs",
        icon: "audit",
        permission: PERMISSIONS.audit,
        status: "integration-pending",
        description: "Read-only audit trail and security monitoring.",
        briefSection: 17,
      },
      {
        key: "settings",
        label: "System Settings",
        href: "/admin/settings",
        icon: "settings",
        permission: PERMISSIONS.settings,
        status: "live",
        description: "Authorized operational summary.",
        briefSection: 18,
      },
    ],
  },
];

/** Flat list, in sidebar order. Used by the sidebar and the route inventory. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items);

/** Every admin route the portal declares. Used by tests to catch drift. */
export const ADMIN_ROUTES: string[] = ADMIN_NAV_ITEMS.map((item) => item.href);

/**
 * Filters navigation by the staff member's backend-confirmed permissions.
 *
 * A group with no visible items disappears entirely — an empty heading is noise
 * and leaks which sections exist. This is a UI convenience ONLY. The backend
 * authorizes every request regardless of what is rendered.
 */
export function visibleNav(permissions: readonly string[]): AdminNavGroup[] {
  const granted = new Set(permissions);
  return ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => granted.has(item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** Page header content for a route, with a safe fallback. */
export function navItemFor(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV_ITEMS.find((item) => item.href === pathname);
}
