/**
 * PROVIDER SYNCHRONISATION — RUNTIME test of the REAL AuthProvider and the REAL
 * Joint components.
 *
 * Provenance: `[REAL provider + REAL component]`. The AuthProvider, the guards,
 * JointAccountProvider, JointInvitationsContent and JointApplicantDetailsForm
 * are the shipped files, mounted with react-test-renderer. Only
 * `next/navigation`, `next/link`, `FormData` and `globalThis.fetch` are
 * substituted. The access token, refresh rotation, 401 handling and logout rules
 * are the real lib/api/client ones.
 *
 * This matrix answers the V3 defect directly: a refresh the provider did NOT
 * commit must never authorise the Joint dashboard, even when a standalone /me
 * would have succeeded.
 */
import { createElement } from "react";
import type { ReactTestRenderer } from "react-test-renderer";
import { JointAccountProvider } from "../../components/joint/JointAccountProvider";
import { JointInvitationsContent } from "../../components/joint/JointInvitationsContent";
import { JointApplicantDetailsForm } from "../../components/auth/JointApplicantDetailsForm";
import { RequireAccountContext } from "../../components/auth/RequireIndividualAuth";
import { getCurrentUser } from "../../lib/api/client";
import {
  clickButton,
  hasButton,
  harness,
  installBackendMock,
  makeProbe,
  mountWithProvider,
  settle,
  submitForm,
  textOf,
  typeInto,
} from "./runtime-support";

const SENTINEL = "JOINT-PORTAL-SENTINEL";

function reset() {
  const h = harness();
  h.router.pushes = [];
  h.router.replaces = [];
  h.router.pathname = "/joint/invitations";
  h.calls = {};
  h.me = { kind: "ok" };
  h.refresh = { kind: "ok" };
  h.projection = { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 };
  h.acceptedInvitations = [];
  h.createdAccounts = 0;
  h.accounts = [
    { jointAccountId: "joint-1", displayName: "The Okeke Family", memberCount: 2, holderNames: ["Ada Okeke", "Sam Bello"], myJoinedAt: "2026-11-17T10:00:00.000Z", isFull: true, awaitingSecondHolder: false },
  ];
  h.invitations = [
    { invitationId: "inv-1", jointAccountId: "joint-1", accountDisplayName: "The Okeke Family", inviterFirstName: "Ada", expiresAt: "2026-11-24T10:00:00.000Z", sentAt: "2026-11-17T09:00:00.000Z" },
  ];
}

/** Mounts the real inbox inside the real JointAccountProvider and a JOINT guard. */
async function mountInbox() {
  const probe = makeProbe();
  const renderer = await mountWithProvider(
    createElement(
      "div",
      null,
      createElement(probe.Probe),
      createElement(JointAccountProvider as never, null, createElement(JointInvitationsContent as never, null)),
      createElement(RequireAccountContext as never, { context: "JOINT" }, createElement("div", null, SENTINEL)),
    ),
  );
  return { renderer, probe };
}

async function acceptFirstInvitation(renderer: ReactTestRenderer) {
  await clickButton(renderer, "Accept");
  await clickButton(renderer, "Accept invitation");
}

type Check = (condition: boolean, message: string) => void;
export type Group = { name: string; run: (check: Check) => Promise<void> };

export const groups: Group[] = [
  // ===========================================================================
  // 1. THE V3 DEFECT. A failed provider refresh must not be rescued by a
  //    successful standalone /me.
  // ===========================================================================
  {
    name: "failed provider refresh + successful standalone /me does not authorise Joint",
    async run(check) {
      reset();
      const h = harness();
      const { renderer, probe } = await mountInbox();
      // Session restore has already succeeded. From here every /me is the
      // membership-refresh read, and it fails.
      const realFetch = (globalThis as any).fetch;
      (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input).replace(/^\/api\/v1/, "").split("?")[0];
        if (path === "/me") throw new TypeError("network down during membership refresh");
        return realFetch(input, init);
      };
      await acceptFirstInvitation(renderer);
      (globalThis as any).fetch = realFetch;

      check(h.acceptedInvitations.length === 1, `the invitation must be accepted exactly once (got ${h.acceptedInvitations.length})`);
      check(!h.router.pushes.includes("/joint/dashboard"), "a failed provider refresh must NOT navigate into the Joint dashboard");
      check(probe.latest()?.contexts?.includes("JOINT") !== true, "the provider must still hold the pre-change projection");
      check(hasButton(renderer, "Refresh access"), "a safe, non-repeating retry of permission refresh must be offered");
      check(/saved|not opened|refresh/i.test(textOf(renderer)), "the user must be told the change was saved and access was not refreshed");

      // The trap V3 fell into: a standalone /me now succeeds and reports JOINT.
      h.projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
      const standalone = await getCurrentUser();
      check(standalone.authorizedContexts?.includes("JOINT") === true, "the standalone /me in this scenario DOES report JOINT (this is the trap)");
      check(!h.router.pushes.includes("/joint/dashboard"), "a standalone successful /me must never authorise the Joint dashboard on its own");
      check(probe.latest()?.contexts?.includes("JOINT") !== true, "the provider still holds the stale projection, so the guard must still refuse the portal");
      renderer.unmount();
    },
  },

  // ===========================================================================
  // 2. A committed refresh updates the provider's ACTUAL user state.
  // ===========================================================================
  {
    name: "a committed refresh updates the provider's actual user state",
    async run(check) {
      reset();
      const h = harness();
      const { renderer, probe } = await mountInbox();
      check(probe.latest()?.contexts !== null, "the provider must hold a projection before the change");
      check(probe.latest()?.contexts?.includes("JOINT") !== true, "JOINT must be absent before the change");
      h.projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
      await acceptFirstInvitation(renderer);
      check(probe.latest()?.contexts?.includes("JOINT") === true, "after a successful refresh the PROVIDER's user.authorizedContexts must include JOINT");
      check(probe.latest()?.status === "authenticated", "the provider must remain authenticated");
      check((h.calls["POST /auth/refresh"] ?? 0) >= 1, "the existing refreshSession token-rotation mechanics must have run");
      check(h.router.pushes.includes("/joint/dashboard"), "a committed provider refresh must navigate into the Joint dashboard");
      check(h.acceptedInvitations.length === 1, "the successful path must accept exactly once");
      renderer.unmount();
    },
  },

  // ===========================================================================
  // 3. Retry after a stale refresh succeeds WITHOUT repeating the mutation.
  // ===========================================================================
  {
    name: "retry after a stale refresh does not repeat the acceptance",
    async run(check) {
      reset();
      const h = harness();
      const { renderer, probe } = await mountInbox();
      h.me = { kind: "network" };
      await acceptFirstInvitation(renderer);
      check(h.acceptedInvitations.length === 1, "the first attempt must accept exactly once");
      check(!h.router.pushes.includes("/joint/dashboard"), "a stale provider must not navigate");
      check(!probe.latest()?.contexts?.includes("JOINT"), "the provider must not have JOINT while stale");

      // Transient failure over: the retry re-reads permission only.
      h.me = { kind: "ok" };
      h.projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
      await clickButton(renderer, "Refresh access");

      check(h.acceptedInvitations.length === 1, `retrying permission refresh must NOT accept the invitation again (accepts=${h.acceptedInvitations.length})`);
      check((h.calls["POST /me/joint-invitations/inv-1/accept"] ?? 0) === 1, "the accept endpoint must be hit exactly once across the whole flow");
      check(probe.latest()?.contexts?.includes("JOINT") === true, "the retry must update the provider's user state");
      check(h.router.pushes.includes("/joint/dashboard"), "a successful retry may then enter the Joint dashboard");
      renderer.unmount();
    },
  },

  // ===========================================================================
  // 4. Joint account creation: same guarantees.
  // ===========================================================================
  {
    name: "Joint creation is never repeated due to a refresh failure",
    async run(check) {
      reset();
      const h = harness();
      h.router.pathname = "/register/joint";
      h.projection = { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 };
      const probe = makeProbe();
      const renderer = await mountWithProvider(
        createElement("div", null, createElement(probe.Probe), createElement(JointApplicantDetailsForm as never, null)),
      );

      // The invitee input is controlled, so type through its real onChange.
      await typeInto(renderer, { type: "email" }, "sam@example.test");
      h.me = { kind: "network" };
      await submitForm(renderer);
      check(h.createdAccounts === 1, `creating the Joint account must happen exactly once (got ${h.createdAccounts})`);
      check(!h.router.pushes.includes("/joint/dashboard"), "a failed provider refresh after creation must not open the Joint dashboard");
      check(!hasButton(renderer, "Open Joint Accounts"), "the portal entry must not be offered while the provider is stale");
      check(hasButton(renderer, "Refresh access"), "a safe retry of permission refresh must be offered");
      check(/already been created|not opened|saved/i.test(textOf(renderer)), "the user must be told the account exists and only access refresh is pending");

      h.me = { kind: "ok" };
      h.projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
      await clickButton(renderer, "Refresh access");
      check(h.createdAccounts === 1, `retrying permission refresh must NOT create a second Joint account (creates=${h.createdAccounts})`);
      check(probe.latest()?.contexts?.includes("JOINT") === true, "the provider's user state must carry JOINT after the retry");
      check(hasButton(renderer, "Open Joint Accounts"), "after a committed refresh the portal entry must be offered");

      await clickButton(renderer, "Open Joint Accounts");
      check(h.router.pushes.includes("/joint/dashboard"), "the offered entry must navigate to the Joint dashboard");
      renderer.unmount();
    },
  },

  // ===========================================================================
  // 5. Backend-confirmed session end during refresh.
  // ===========================================================================
  {
    name: "backend-confirmed session end during refresh preserves the change",
    async run(check) {
      reset();
      const h = harness();
      const { renderer, probe } = await mountInbox();
      h.refresh = { kind: "unauthenticated" };
      h.me = { kind: "unauthenticated" };
      await acceptFirstInvitation(renderer);
      check(h.acceptedInvitations.length === 1, "the acceptance must not be repeated on a session end");
      check(!h.router.pushes.includes("/joint/dashboard"), "an ended session must not open the Joint dashboard");
      // The only proof the backend gives is UNAUTHENTICATED; the provider's
      // existing logout rule must honour it so the guard sends the user to login.
      check(probe.latest()?.status === "unauthenticated", `a backend-confirmed session end must leave the provider unauthenticated (got ${probe.latest()?.status})`);
      check(probe.latest()?.userId === null, "the provider must not keep a user projection after a confirmed session end");
      renderer.unmount();
    },
  },

  // ===========================================================================
  // 6. An Individual investor can open the inbox (direct URL) and accept.
  // ===========================================================================
  {
    name: "Individual invitee opens the inbox by direct URL and accepts",
    async run(check) {
      reset();
      const h = harness();
      const { renderer, probe } = await mountInbox();
      check(probe.latest()?.status === "authenticated", "session restore must succeed for the Individual invitee");
      check(textOf(renderer).includes("The Okeke Family"), "an Individual-only invitee must see the pending invitation");
      check(hasButton(renderer, "Accept"), "an Individual-only invitee must be able to accept");
      check(!textOf(renderer).includes("No Joint portal access"), "the inbox must not show a Joint denial to an Individual invitee");
      h.projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
      await acceptFirstInvitation(renderer);
      check(h.acceptedInvitations.length === 1, "accepting must call the backend exactly once");
      check(h.router.pushes.includes("/joint/dashboard"), "the accepted member must reach the Joint dashboard");
      renderer.unmount();
    },
  },

  // ===========================================================================
  // 7. Direct URL entry and a page refresh cannot bypass the Joint guard.
  // ===========================================================================
  {
    name: "direct URL and remount cannot bypass the Joint guard",
    async run(check) {
      reset();
      const h = harness();
      // An Individual-only user goes straight to /joint/dashboard by URL.
      h.router.pathname = "/joint/dashboard";
      h.projection = { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 };
      const probe = makeProbe();
      const renderer = await mountWithProvider(
        createElement(
          "div",
          null,
          createElement(probe.Probe),
          createElement(RequireAccountContext as never, { context: "JOINT" }, createElement("div", null, SENTINEL)),
        ),
      );
      check(!textOf(renderer).includes(SENTINEL), "direct URL entry to /joint/dashboard must not render the portal for an Individual-only user");
      check(/No Joint portal access/i.test(textOf(renderer)), "direct URL entry must show the Joint access notice");
      renderer.unmount();

      // Page refresh = a full remount with the still-stale backend truth.
      h.router.pathname = "/joint/dashboard";
      const remount = await mountWithProvider(
        createElement(RequireAccountContext as never, { context: "JOINT" }, createElement("div", null, SENTINEL)),
      );
      check(!textOf(remount).includes(SENTINEL), "a page refresh must not render the portal either");
      remount.unmount();

      // The same URL after the backend truth changes is allowed.
      h.projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
      h.router.pathname = "/joint/dashboard";
      const allowed = await mountWithProvider(
        createElement(RequireAccountContext as never, { context: "JOINT" }, createElement("div", null, SENTINEL)),
      );
      check(textOf(allowed).includes(SENTINEL), "a genuine Joint member must reach /joint/dashboard after a remount");
      allowed.unmount();
    },
  },
  // ===========================================================================
  // 8. Mixed account classifications: the portal is not mounted when the
  //    backend's own guard would reject its every data call.
  // ===========================================================================
  {
    name: "mixed classification does not promise a portal the backend rejects",
    async run(check) {
      reset();
      const h = harness();
      h.router.pathname = "/corporate/dashboard";

      // Healthy Corporate applicant: the projection and the backend agree.
      h.projection = { authorizedContexts: ["CORPORATE"], companyName: "Okeke Ltd", primaryAccountType: "CORPORATE" } as never;
      const healthy = await mountWithProvider(
        createElement(RequireAccountContext as never, { context: "CORPORATE" }, createElement("div", null, SENTINEL)),
      );
      check(textOf(healthy).includes(SENTINEL), "a consistent Corporate account must receive the Corporate portal");
      check(!/Account classification/i.test(textOf(healthy)), "a consistent Corporate account must not see a classification notice");
      healthy.unmount();

      // Primary INDIVIDUAL with Corporate evidence: safeUser() grants CORPORATE
      // but CorporateApplicantContextService rejects primary INDIVIDUAL.
      h.projection = { authorizedContexts: ["INDIVIDUAL", "CORPORATE"], primaryAccountType: "INDIVIDUAL" } as never;
      const mixed = await mountWithProvider(
        createElement(RequireAccountContext as never, { context: "CORPORATE" }, createElement("div", null, SENTINEL)),
      );
      const mixedText = textOf(mixed);
      check(!mixedText.includes(SENTINEL), "a mixed-classification Corporate portal must not be mounted");
      check(/Account classification/i.test(mixedText), "the user must be told the classification is the problem");
      check(/support/i.test(mixedText), "the user must be pointed to support");
      check(/no documents were submitted|nothing/i.test(mixedText), "the user must be reassured nothing was submitted or changed");
      // The portal is not mounted, so no Corporate data call can be attempted.
      check(!Object.keys(h.calls).some((key) => key.includes("corporate")), `no Corporate API call may be attempted (saw ${Object.keys(h.calls).join(", ")})`);
      mixed.unmount();

      // The Individual portal for the same account is unaffected.
      h.router.pathname = "/dashboard";
      h.projection = { authorizedContexts: ["INDIVIDUAL", "CORPORATE"], primaryAccountType: "INDIVIDUAL" } as never;
      const individual = await mountWithProvider(
        createElement(RequireAccountContext as never, { context: "INDIVIDUAL" }, createElement("div", null, SENTINEL)),
      );
      check(textOf(individual).includes(SENTINEL), "the Individual portal must remain available for that account");
      individual.unmount();
    },
  },
];

/**
 * Runs every group independently. A crash inside one group is reported as that
 * group's failure instead of suppressing the other groups' assertions.
 */
export async function runProviderSyncMatrix(): Promise<string[]> {
  installBackendMock();
  const failures: string[] = [];
  for (const group of groups) {
    const groupFailures: string[] = [];
    const check: Check = (condition, message) => { if (!condition) groupFailures.push(`[${group.name}] ${message}`); };
    try {
      // Sequential by design: each group mounts and unmounts a real provider.
      // eslint-disable-next-line no-await-in-loop
      await group.run(check);
    } catch (error) {
      groupFailures.push(`[${group.name}] crashed: ${error instanceof Error ? error.message : String(error)}`);
    }
    failures.push(...groupFailures);
  }
  return failures;
}
