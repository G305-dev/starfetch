/**
 * MEMBERSHIP-CHANGE REFRESH — RUNTIME test of the ACTUAL shipped module.
 *
 * Provenance: `[REAL module]`. Imports and executes
 * lib/auth/membership-context-refresh.ts exactly as the Joint forms do.
 *
 * The single most important assertion here is a negative one: the module must
 * issue NO network request of its own. Authorisation is read only from what
 * AuthProvider committed. If this module ever started calling /me itself, this
 * matrix fails.
 */
import type { SessionRefreshOutcome } from "../../components/auth/AuthProvider";
import {
  canEnterJointPortal,
  refreshContextsAfterMembershipChange,
  resolveMembershipContextRefresh,
  shouldOfferJointPortal,
} from "../../lib/auth/membership-context-refresh";

/** Counts any HTTP attempt made by the module under test. */
function instrumentNetwork() {
  const counter = { calls: 0 };
  (globalThis as any).fetch = async () => {
    counter.calls += 1;
    throw new Error("the membership refresh module must not make its own requests");
  };
  return counter;
}

const userWith = (contexts?: Array<"INDIVIDUAL" | "JOINT" | "CORPORATE">) =>
  ({ id: "u1", firstName: "Ada", lastName: "Okeke", email: "ada@example.test", role: "INVESTOR", authorizedContexts: contexts } as never);

let checksRun = 0;
export function checkCount() { return checksRun; }

export async function runMembershipRefreshMatrix(): Promise<string[]> {
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => { checksRun += 1; if (!condition) failures.push(message); };

  // --- 1. The provider committed a fresh projection with JOINT -------------
  const refreshed = resolveMembershipContextRefresh({ status: "refreshed", user: userWith(["INDIVIDUAL", "JOINT"]) });
  check(refreshed.status === "refreshed", "A committed provider refresh must report refreshed");
  check(canEnterJointPortal(refreshed), "Committed JOINT must allow the Joint dashboard");
  check(shouldOfferJointPortal(refreshed), "Committed JOINT must offer the portal entry");

  // --- 2. Committed, but still no JOINT ------------------------------------
  const noJoint = resolveMembershipContextRefresh({ status: "refreshed", user: userWith(["INDIVIDUAL"]) });
  check(noJoint.status === "refreshed", "A committed refresh is reported even when JOINT is absent");
  check(!canEnterJointPortal(noJoint), "Without JOINT in the provider's projection the portal stays closed");

  // --- 3. Committed projection missing authorizedContexts -----------------
  const malformed = resolveMembershipContextRefresh({ status: "refreshed", user: userWith(undefined) });
  check(malformed.status === "stale", "A projection without authorizedContexts must fail closed as stale");
  check(!canEnterJointPortal(malformed), "A malformed projection must not authorise the portal");

  // --- 4. Every non-committing provider outcome is stale ------------------
  const nonCommitting: Array<[SessionRefreshOutcome, string]> = [
    [{ status: "unchanged" }, "unchanged"],
    [{ status: "superseded" }, "superseded"],
    [{ status: "error" }, "error"],
  ];
  for (const [outcome, label] of nonCommitting) {
    const result = resolveMembershipContextRefresh(outcome);
    check(result.status === "stale", `Provider outcome "${label}" must be treated as stale, not success`);
    check(!canEnterJointPortal(result), `Provider outcome "${label}" must not authorise the Joint dashboard`);
  }

  // --- 5. Backend-confirmed session end is distinct -----------------------
  const ended = resolveMembershipContextRefresh({ status: "unauthenticated" });
  check(ended.status === "unauthenticated", "A provider-confirmed session end must be reported distinctly");
  check(!canEnterJointPortal(ended), "An ended session must not authorise the portal");

  // --- 6. Narrow path: stale/ended never grant, even for the inbox --------
  check(!canEnterJointPortal({ status: "stale" }, "/joint/invitations"), "A stale read must not even open the inbox");
  check(!canEnterJointPortal({ status: "unauthenticated" }, "/joint/invitations"), "An ended session must not open the inbox");
  check(canEnterJointPortal(refreshed, "/joint/invitations"), "Committed JOINT may open the inbox");

  // --- 7. The module issues NO request of its own -------------------------
  const network = instrumentNetwork();
  const outcome = { status: "refreshed", user: userWith(["INDIVIDUAL", "JOINT"]) } as SessionRefreshOutcome;
  let refreshCalls = 0;
  const result = await refreshContextsAfterMembershipChange(async () => { refreshCalls += 1; return outcome; });
  check(refreshCalls === 1, "The provider's refreshSession must be invoked exactly once");
  check(network.calls === 0, `The module must not make its own /me request (made ${network.calls})`);
  check(canEnterJointPortal(result), "A committed outcome must still authorise the portal");

  // --- 8. A throwing refresh resolves as stale, never throws --------------
  let threw = false;
  let thrownResult = null as Awaited<ReturnType<typeof refreshContextsAfterMembershipChange>> | null;
  try {
    thrownResult = await refreshContextsAfterMembershipChange(async () => { throw new Error("refresh boom"); });
  } catch {
    threw = true;
  }
  check(!threw, "A throwing refreshSession must not propagate — the membership change already succeeded");
  check(thrownResult?.status === "stale", "A throwing refreshSession must resolve as stale");

  // --- 9. Never a logout, never a repeat: statuses are the only output ----
  const allOutcomes: SessionRefreshOutcome[] = [
    { status: "refreshed", user: userWith(["INDIVIDUAL", "JOINT"]) },
    { status: "refreshed", user: userWith(["INDIVIDUAL"]) },
    { status: "unchanged" },
    { status: "superseded" },
    { status: "error" },
    { status: "unauthenticated" },
  ];
  for (const outcomeValue of allOutcomes) {
    const mapped = resolveMembershipContextRefresh(outcomeValue);
    check(["refreshed", "stale", "unauthenticated"].includes(mapped.status), `Unexpected status ${mapped.status}`);
  }

  return failures;
}
