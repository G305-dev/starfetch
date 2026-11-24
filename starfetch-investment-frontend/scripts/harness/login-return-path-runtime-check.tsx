/**
 * LOGIN RETURN PATHS — RUNTIME test of the REAL SignInForm + REAL resolver.
 *
 * Provenance: `[REAL component]`. The shipped SignInForm is mounted with
 * react-test-renderer and its actual submit handler is invoked. The account-type
 * buttons are clicked for real, so "the user selected Corporate" is a genuine
 * component state, not a parameter passed to a copy of the logic.
 *
 * Covers the V4 requirement: a `/joint/invitations` or `/register/joint` return
 * URL must serve an authorised Individual investor, and must never override an
 * unauthorised Corporate selection.
 */
import { createElement } from "react";
import { SignInForm } from "../../components/auth/SignInForm";
import { isJointJourneyPathAuthorized, resolveLoginDestination } from "../../lib/auth/account-context-access";
import { harness, installBackendMock, mountWithProvider, settle, textOf } from "./runtime-support";

type Case = {
  name: string;
  accountType: "Individual" | "Joint" | "Business / Corporate";
  next: string | null;
  contexts: Array<"INDIVIDUAL" | "JOINT" | "CORPORATE"> | null;
  expectDestination: string | null;
  expectNotice: boolean;
};

/**
 * Each case is a genuine component interaction: click the account-type button,
 * fill the form, submit, then read what the real component did with the router.
 */
export const cases: Case[] = [
  // --- the two Joint investor journeys, for an authorised Individual --------
  { name: "Individual + ?next=/joint/invitations -> inbox", accountType: "Joint", next: "/joint/invitations", contexts: ["INDIVIDUAL"], expectDestination: "/joint/invitations", expectNotice: false },
  { name: "Individual (Inbox button default) + ?next=/joint/invitations", accountType: "Individual", next: "/joint/invitations", contexts: ["INDIVIDUAL"], expectDestination: "/joint/invitations", expectNotice: false },
  { name: "Joint member + ?next=/joint/invitations -> inbox", accountType: "Joint", next: "/joint/invitations", contexts: ["INDIVIDUAL", "JOINT"], expectDestination: "/joint/invitations", expectNotice: false },
  { name: "Individual + ?next=/register/joint -> application", accountType: "Joint", next: "/register/joint", contexts: ["INDIVIDUAL"], expectDestination: "/register/joint", expectNotice: false },

  // --- the Corporate-selection override must NOT work ----------------------
  { name: "Corporate selection + ?next=/joint/invitations (Individual+Corporate account) -> Corporate dashboard, not the inbox", accountType: "Business / Corporate", next: "/joint/invitations", contexts: ["INDIVIDUAL", "CORPORATE"], expectDestination: "/corporate/dashboard", expectNotice: false },
  { name: "Corporate selection + ?next=/register/joint (Individual+Corporate account) -> Corporate dashboard", accountType: "Business / Corporate", next: "/register/joint", contexts: ["INDIVIDUAL", "CORPORATE"], expectDestination: "/corporate/dashboard", expectNotice: false },
  // A Corporate account is a legitimate investor: it lands on its own dashboard.
  // The Joint return path is simply discarded and, crucially, nothing under
  // /joint is reached (asserted separately below via isJointInvestorJourneyPath).
  { name: "Corporate-only + ?next=/joint/invitations -> its own dashboard, never the inbox", accountType: "Business / Corporate", next: "/joint/invitations", contexts: ["CORPORATE"], expectDestination: "/corporate/dashboard", expectNotice: false },
  { name: "Corporate-only + ?next=/register/joint -> its own dashboard, never the application", accountType: "Business / Corporate", next: "/register/joint", contexts: ["CORPORATE"], expectDestination: "/corporate/dashboard", expectNotice: false },

  // --- the special return paths never bypass the selected portal ----------
  { name: "Corporate selection + ?next=/joint/invitations, no Corporate context -> blocked", accountType: "Business / Corporate", next: "/joint/invitations", contexts: ["INDIVIDUAL"], expectDestination: null, expectNotice: true },
  { name: "Joint selection + ?next=/joint/dashboard, Individual only -> blocked", accountType: "Joint", next: "/joint/dashboard", contexts: ["INDIVIDUAL"], expectDestination: null, expectNotice: true },
  { name: "Joint selection + ?next=/joint/invitations/abc, Individual only -> blocked (exact path only)", accountType: "Joint", next: "/joint/invitations/abc", contexts: ["INDIVIDUAL"], expectDestination: null, expectNotice: true },

  // --- unchanged behaviour that must not regress --------------------------
  { name: "Individual -> /dashboard", accountType: "Individual", next: null, contexts: ["INDIVIDUAL"], expectDestination: "/dashboard", expectNotice: false },
  { name: "Corporate -> /corporate/dashboard", accountType: "Business / Corporate", next: null, contexts: ["CORPORATE"], expectDestination: "/corporate/dashboard", expectNotice: false },
  { name: "Individual-only -> Corporate selection blocked", accountType: "Business / Corporate", next: null, contexts: ["INDIVIDUAL"], expectDestination: null, expectNotice: true },
  { name: "Unverifiable projection -> blocked", accountType: "Individual", next: null, contexts: null, expectDestination: null, expectNotice: true },
  { name: "Empty contexts -> blocked", accountType: "Individual", next: null, contexts: [], expectDestination: null, expectNotice: true },
];

export const caseCount = cases.length;

async function runCase(testCase: Case): Promise<string[]> {
  const failures: string[] = [];
  const h = harness();
  h.router.pushes = [];
  h.router.replaces = [];
  h.router.pathname = "/login";
  h.me = { kind: "ok" };
  h.refresh = { kind: "ok" };
  h.projection = {
    authorizedContexts: testCase.contexts ?? undefined,
    jointMembershipCount: testCase.contexts?.includes("JOINT") ? 1 : 0,
  };
  // A projection with no authorizedContexts must genuinely omit the field.
  if (testCase.contexts === null) delete (h.projection as Record<string, unknown>).authorizedContexts;

  installBackendMock();

  // `?next=` is read through useSearchParams, substituted from globalThis.
  (globalThis as any).__sfSearch = new URLSearchParams(testCase.next ? { next: testCase.next } : {});
  const renderer = await mountWithProvider(createElement(SignInForm as never, null));

  const buttons = renderer.root.findAllByType("button" as never);
  const label = testCase.accountType;
  const typeButton = buttons.find((node: any) => nodeTextOf(node).trim() === label);
  if (!typeButton) {
    failures.push(`${testCase.name}: the account-type button "${label}" was not rendered`);
    renderer.unmount();
    return failures;
  }
  const { act } = require("react-test-renderer");
  await act(async () => { typeButton.props.onClick({ preventDefault() {}, stopPropagation() {} }); });

  // The real inputs are UNCONTROLLED: the submitted values come from FormData.
  // The preload supplies that browser boundary; the values below are what a
  // user would have typed into the real fields.
  const inputs = renderer.root.findAllByType("input" as never);
  const email = inputs.find((node: any) => node.props.name === "email");
  const password = inputs.find((node: any) => node.props.name === "password");
  if (!email || !password) {
    failures.push(`${testCase.name}: email/password inputs were not rendered`);
    renderer.unmount();
    return failures;
  }
  const form = renderer.root.findByType("form" as never);
  await act(async () => {
    await form.props.onSubmit({
      preventDefault() {},
      currentTarget: { __fields: { email: "ada@example.test", password: "correct-horse" } },
    });
  });
  await settle();

  const navigated = [...h.router.replaces, ...h.router.pushes];
  const destination = navigated.find((target) => target !== "/login") ?? null;
  const expected = testCase.expectDestination;
  if (expected === null) {
    if (destination !== null) failures.push(`${testCase.name}: expected no navigation, got ${JSON.stringify(destination)}`);
  } else if (destination !== expected) {
    failures.push(`${testCase.name}: expected destination ${JSON.stringify(expected)}, got ${JSON.stringify(navigated)}`);
  }
  // Hard invariant: whatever happens, a destination under the Joint portal space
  // may never be reached by an account that is not authorised for it.
  if (destination && destination.startsWith("/joint") && !isJointJourneyPathAuthorized(testCase.contexts, destination)) {
    failures.push(`${testCase.name}: reached a Joint path ${destination} that the guard would refuse`);
  }
  const noticeShown = /Account access/i.test(textOf(renderer));
  if (noticeShown !== testCase.expectNotice) {
    failures.push(`${testCase.name}: expected access notice=${testCase.expectNotice}, got ${noticeShown}`);
  }
  renderer.unmount();
  return failures;
}

function nodeTextOf(node: any): string {
  const walk = (value: any): string => {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(walk).join("");
    if (value.children) return value.children.map(walk).join("");
    return "";
  };
  return walk(node);
}

/**
 * Consistency guard: the destination the login resolver picks must be a path
 * the matching route guard would also accept. These are the SAME predicates the
 * guards use, so the two checks cannot drift.
 */
function runGuardConsistency(): string[] {
  const failures: string[] = [];
  const table: Array<[string, Array<"INDIVIDUAL" | "JOINT" | "CORPORATE">, boolean]> = [
    ["/joint/invitations", ["INDIVIDUAL"], true],
    ["/joint/dashboard", ["INDIVIDUAL"], false],
    ["/joint/invitations", ["INDIVIDUAL", "JOINT"], true],
    ["/joint/invitations", ["CORPORATE"], false],
    ["/register/joint", ["INDIVIDUAL"], true],
    ["/register/joint", ["JOINT"], false],
    ["/joint/invitations", [], false],
  ];
  for (const [path, contexts, expected] of table) {
    const actual = isJointJourneyPathAuthorized(contexts, path);
    if (actual !== expected) failures.push(`shared rule: ${path} with [${contexts.join(",")}] expected ${expected}, got ${actual}`);
  }
  // The resolver's destination must agree with the shared rule for both Joint
  // selections, so login and the guard that renders the destination cannot drift.
  for (const [path, contexts] of table) {
    for (const selected of ["INDIVIDUAL", "JOINT"] as const) {
      const { destination } = resolveLoginDestination({ authorizedContexts: contexts }, selected, path);
      const guardWouldAllow = isJointJourneyPathAuthorized(contexts, path);
      if ((destination === path) !== guardWouldAllow) {
        failures.push(`resolver/guard disagreement: ${path} with [${contexts.join(",")}] selected=${selected} -> destination ${JSON.stringify(destination)} but guard allows=${guardWouldAllow}`);
      }
    }
  }
  return failures;
}

export async function runAll(): Promise<string[]> {
  installBackendMock();
  const failures: string[] = [];
  for (const testCase of cases) {
    // Sequential by design: each case mounts and unmounts a real provider.
    // eslint-disable-next-line no-await-in-loop
    failures.push(...(await runCase(testCase)));
  }
  failures.push(...runGuardConsistency());
  return failures;
}
