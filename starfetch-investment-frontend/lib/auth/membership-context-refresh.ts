import type { SessionRefreshOutcome } from "@/components/auth/AuthProvider";
import type { AuthAccountContext } from "../api/client";
import { isJointPathAllowed } from "./account-context-access";

/**
 * Re-derives portal authorisation after a Joint membership change, using ONLY
 * what AuthProvider actually committed to its own `user` state.
 *
 * Creating a Joint account or accepting an invitation changes
 * `authorizedContexts` on the server. The provider's in-memory projection is
 * stale until the provider itself re-reads it, so navigating straight to
 * /joint/dashboard would be refused by the context guard.
 *
 * Why this takes the provider's refresh outcome rather than issuing its own
 * `/me` request: a second, independent `/me` read can succeed while the
 * provider is still holding the old projection — for example when the token
 * rotation succeeds but the provider's own user read fails. Reporting that as
 * "refreshed" would navigate the user into a portal the provider does not
 * authorise them for, which is precisely the failure this must prevent. The
 * provider is the single source of truth for `user`, so authorisation is read
 * from its committed result and from nothing else.
 *
 * The refresh reuses the existing session mechanics unchanged: token rotation,
 * cookie handling, CSRF, logout and the "never log out on a transient error"
 * rule all still live in AuthProvider/lib/api/client and are untouched here.
 */
export type MembershipContextRefresh =
  /** The provider committed a fresh projection carrying these contexts. */
  | { status: "refreshed"; contexts: AuthAccountContext[] }
  /**
   * The membership change succeeded, but the provider still holds the previous
   * projection. The change is preserved; the caller must offer a safe retry and
   * must NOT navigate into the portal.
   */
  | { status: "stale" }
  /** The backend confirmed the session is gone. */
  | { status: "unauthenticated" };

/**
 * Maps the provider's own refresh outcome onto the membership decision.
 *
 * `superseded`, `unchanged` and `error` all mean the provider did not commit a
 * new projection, so they fail closed as `stale`. A failed refresh is never
 * allowed to undo anything the backend already accepted.
 */
export function resolveMembershipContextRefresh(outcome: SessionRefreshOutcome): MembershipContextRefresh {
  if (outcome.status === "unauthenticated") return { status: "unauthenticated" };
  if (outcome.status !== "refreshed") return { status: "stale" };
  // The projection the provider committed must actually carry contexts; a
  // response without them cannot authorise anything.
  if (!Array.isArray(outcome.user.authorizedContexts)) return { status: "stale" };
  return { status: "refreshed", contexts: outcome.user.authorizedContexts };
}

/**
 * Runs the provider's refresh and reports what the provider now holds.
 * Never throws: a refresh problem is never proof that the membership change
 * failed, so it must not surface as a mutation error.
 */
export async function refreshContextsAfterMembershipChange(
  refreshSession: () => Promise<SessionRefreshOutcome>,
): Promise<MembershipContextRefresh> {
  let outcome: SessionRefreshOutcome;
  try {
    outcome = await refreshSession();
  } catch {
    // A throwing refresh is still only a refresh problem.
    return { status: "stale" };
  }
  return resolveMembershipContextRefresh(outcome);
}

/** Whether the provider's freshly committed contexts allow the Joint portal. */
export function canEnterJointPortal(result: MembershipContextRefresh, pathname = "/joint/dashboard"): boolean {
  return result.status === "refreshed" && isJointPathAllowed(result.contexts, pathname);
}

/**
 * Whether the user may be offered the portal entry at all. Identical to
 * `canEnterJointPortal` but named for the success screens, where "retry
 * permission refresh" is the alternative.
 */
export function shouldOfferJointPortal(result: MembershipContextRefresh | null): boolean {
  return result !== null && canEnterJointPortal(result);
}

/**
 * Copy for the stale case. Deliberately explicit that (a) the change was saved,
 * (b) nothing is repeated, and (c) the only required action is re-reading
 * permission, never re-submitting.
 */
export const STALE_CONTEXT_MESSAGE =
  "Your Joint account change was saved and will not be repeated. We could not refresh this session's portal access just now, so the Joint dashboard was not opened. Refresh your access to continue — you do not need to create the account or accept the invitation again.";

/** Copy for a session that ended during the refresh; the change is still saved. */
export const UNAUTHENTICATED_CONTEXT_MESSAGE =
  "Your Joint account change was saved, but this session has ended. Sign in again to open the Joint Account — you do not need to create the account or accept the invitation again.";
