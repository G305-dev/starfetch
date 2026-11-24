import type { AuthAccountContext, AuthUser } from "../api/client";

/**
 * Server-derived portal authorisation.
 *
 * The account-type buttons on /login express a navigation preference only. The
 * authoritative source is `authorizedContexts`, which the backend derives from
 * the account's own records (backend `auth.service.ts#safeUser`).
 *
 * `primaryAccountType` is NOT an authorisation source. Every backend route that
 * returns a user projection (`POST /auth/login`, `GET /me`) includes the
 * relations needed to compute `authorizedContexts`, so an absent field means the
 * response is not the expected SafeUser projection — not "old backend". A
 * projection without `authorizedContexts` therefore fails closed.
 */
export type PortalContext = AuthAccountContext;

export type ContextAuthorization = {
  context: PortalContext;
  /** True only when the backend projection proves this context. */
  authorized: boolean;
  /**
   * True when the projection did not carry `authorizedContexts` at all. The
   * guard fails closed; the message differs so support can tell the two apart.
   */
  unverified: boolean;
  reason: string;
};

export const portalLabels: Record<PortalContext, string> = {
  INDIVIDUAL: "Individual",
  JOINT: "Joint",
  CORPORATE: "Corporate",
};

/** The context a login account-type selection maps to. */
export const loginTypeToPortal = {
  individual: "INDIVIDUAL",
  joint: "JOINT",
  corporate: "CORPORATE",
} as const satisfies Record<string, PortalContext>;

export const portalDashboards: Record<PortalContext, string> = {
  INDIVIDUAL: "/dashboard",
  JOINT: "/joint/dashboard",
  CORPORATE: "/corporate/dashboard",
};

type AuthorizationSource = Pick<AuthUser, "authorizedContexts">;

/**
 * Whether the backend projection proves a given portal context.
 *
 * `authorizedContexts` is the only source. An empty array is a real answer
 * ("no portals") and grants nothing; a missing field grants nothing.
 */
export function isContextAuthorized(user: AuthorizationSource | null | undefined, context: PortalContext): boolean {
  if (!user) return false;
  return Array.isArray(user.authorizedContexts) && user.authorizedContexts.includes(context);
}

export function authorizedPortals(user: AuthorizationSource | null | undefined): PortalContext[] {
  const order: PortalContext[] = ["INDIVIDUAL", "JOINT", "CORPORATE"];
  return order.filter((context) => isContextAuthorized(user, context));
}

export function describeContextAuthorization(user: AuthorizationSource | null | undefined, context: PortalContext): ContextAuthorization {
  const label = portalLabels[context];
  if (isContextAuthorized(user, context)) return { context, authorized: true, unverified: false, reason: "" };
  if (!user || !Array.isArray(user.authorizedContexts)) {
    return {
      context,
      authorized: false,
      unverified: true,
      reason: `We could not confirm which portals this account is authorised for, so the ${label} portal was not opened. Sign in again, and contact Starfetch support if this continues.`,
    };
  }
  const granted = authorizedPortals(user).map((portal) => portalLabels[portal]);
  const available = granted.length
    ? `This account currently has ${granted.join(" and ")} portal access.`
    : "This account currently has no investor portal access.";
  return {
    context,
    authorized: false,
    unverified: false,
    reason: `You are signed in, but this account does not have ${label} portal access. ${available}`,
  };
}

/**
 * Starting a Joint *application* is an Individual-investor journey, not entry to
 * the Joint portal. It deliberately does not depend on JOINT authorisation, so a
 * verified Individual investor with no membership can still start one.
 * Authoritative enforcement remains the backend `IndividualAccountGuard` on
 * `POST /joint-accounts`.
 */
export function canStartJointApplication(user: AuthorizationSource | null | undefined): boolean {
  return isContextAuthorized(user, "INDIVIDUAL");
}

/**
 * The return paths a Joint journey may legitimately produce. Both are
 * Individual-investor journeys: starting an application and reading an
 * invitation both happen BEFORE any Joint membership exists.
 *
 * They are listed explicitly (rather than "anything under /joint") so the
 * exception cannot widen into the Joint portal itself.
 */
export function isJointInvestorJourneyPath(pathname: string): boolean {
  return isJointApplicationPath(pathname) || isJointInvitationInboxPath(pathname);
}

/**
 * The ONE rule for "may these backend-derived contexts open this Joint
 * investor-journey path".
 *
 * It is used by `resolveLoginDestination` and re-asserted against the route
 * guards by the access-control test, so a login destination and the guard that
 * later renders that destination cannot drift apart:
 *
 *   /register/joint      -> INDIVIDUAL only (RequireContextPermission INDIVIDUAL)
 *   /joint/invitations   -> JOINT, or INDIVIDUAL without a membership (isJointPathAllowed)
 *
 * Any other path is not a Joint investor-journey path and returns false.
 */
export function isJointJourneyPathAuthorized(
  contexts: PortalContext[] | null | undefined,
  pathname: string,
): boolean {
  if (!Array.isArray(contexts)) return false;
  if (isJointInvitationInboxPath(pathname)) return isJointPathAllowed(contexts, pathname);
  if (isJointApplicationPath(pathname)) return contexts.includes("INDIVIDUAL");
  return false;
}

/**
 * Safe post-login destination: the selected portal only when the backend proves
 * it.
 *
 * The rules here are deliberately the SAME rules the route guards enforce, so a
 * login can never land a user on a page its own guard would then refuse:
 *
 *  - `/register/joint`                       -> INDIVIDUAL (guard: RequireContextPermission INDIVIDUAL)
 *  - `/joint/invitations`                    -> INDIVIDUAL or JOINT (guard: isJointPathAllowed)
 *  - everything else in the selected portal  -> that portal's context
 *
 * A Joint investor-journey return path is honoured only for a user whose
 * projection actually proves INDIVIDUAL. It never overrides the selected
 * account type for an account that is not an Individual investor, so a
 * Corporate selection cannot be smuggled past the check by crafting `?next=`.
 */
export function resolveLoginDestination(
  user: AuthorizationSource | null | undefined,
  selected: PortalContext,
  returnedPath: string | null,
): { destination: string | null; authorization: ContextAuthorization } {
  const isIndividual = isContextAuthorized(user, "INDIVIDUAL");
  /**
   * A Joint investor-journey return path is only meaningful for the Joint or
   * Individual selections. When the user selected Corporate, the return path is
   * simply not applicable: it is dropped and normal Corporate resolution runs,
   * so a crafted `?next=` can neither grant Corporate access nor hijack it.
   */
  const jointJourneyApplies = selected !== "CORPORATE";

  if (jointJourneyApplies && returnedPath && isJointInvestorJourneyPath(returnedPath)) {
    // Same predicate the route guard uses; no second copy of the rule exists.
    const allowed = isJointJourneyPathAuthorized(user?.authorizedContexts, returnedPath);
    // Reason text is reported against the context that actually governs the
    // path, so a refusal never names a portal the user was not asking for.
    const reference: PortalContext = isIndividual ? "INDIVIDUAL" : selected;
    const journeyAuthorization = describeContextAuthorization(user, reference);
    return allowed
      ? { destination: returnedPath, authorization: { ...journeyAuthorization, authorized: true, unverified: false, reason: "" } }
      : { destination: null, authorization: journeyAuthorization };
  }

  const authorization = describeContextAuthorization(user, selected);
  if (!authorization.authorized) return { destination: null, authorization };
  // A returned path is honoured only when it belongs to the selected portal.
  if (returnedPath && pathBelongsToContext(returnedPath, selected)) return { destination: returnedPath, authorization };
  return { destination: portalDashboards[selected], authorization };
}

/** /register/joint is the Joint application start journey, not the Joint portal. */
export function isJointApplicationPath(pathname: string): boolean {
  const path = pathname.split("?")[0].split("#")[0];
  return path === "/register/joint" || path.startsWith("/register/joint/");
}

/**
 * The invitation inbox is reachable by an authenticated Individual investor who
 * has no Joint membership yet — that is the whole point of an invitation. The
 * backend still gates it (`IndividualAccountGuard` + invitee-scoped queries), so
 * this only opens the *page*, never Joint account data.
 */
export function isJointInvitationInboxPath(pathname: string): boolean {
  const path = pathname.split("?")[0].split("#")[0];
  return path === "/joint/invitations";
}

/**
 * Whether a Joint-portal path may be opened with the backend-derived JOINT
 * context. `/joint/invitations` is additionally allowed on INDIVIDUAL context,
 * because a pending invitation is addressed to an Individual investor before any
 * membership exists. Every other Joint route requires JOINT.
 */
export function isJointPathAllowed(contexts: PortalContext[] | null | undefined, pathname: string): boolean {
  if (!Array.isArray(contexts)) return false;
  if (contexts.includes("JOINT")) return true;
  return isJointInvitationInboxPath(pathname) && contexts.includes("INDIVIDUAL");
}

/** Whether an in-app path is inside a given portal's reserved route space. */
export function pathBelongsToContext(pathname: string, context: PortalContext): boolean {
  const path = pathname.split("?")[0].split("#")[0];
  if (context === "CORPORATE") return path === "/corporate" || path.startsWith("/corporate/");
  if (context === "JOINT") return path === "/joint" || path.startsWith("/joint/");
  if (path === "/corporate" || path.startsWith("/corporate/") || path === "/joint" || path.startsWith("/joint/")) return false;
  // Individual reserved space; public marketing routes are not Individual-only.
  return ["/dashboard", "/investments", "/transactions", "/profile", "/products"].some((base) => path === base || path.startsWith(`${base}/`));
}
