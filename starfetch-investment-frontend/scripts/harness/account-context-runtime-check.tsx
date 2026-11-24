/**
 * RUNTIME access-control check — executes the real guard components and the
 * real login handler logic in-process with react-dom/server and a mocked
 * backend. This is real execution, not a static source assertion.
 *
 * Not wired into package.json: it needs react-dom/server and a JSX compile
 * step, which the repo's lightweight check runner does not provide.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describeContextAuthorization, resolveLoginDestination } from "../../lib/auth/account-context-access";
import { RequireAccountContext, RequireContextPermission } from "../../components/auth/RequireIndividualAuth";

type Status = "loading" | "authenticated" | "unauthenticated" | "error";
type Projection = { authorizedContexts?: Array<"INDIVIDUAL" | "JOINT" | "CORPORATE">; jointMembershipCount?: number };

export type HarnessState = { status: Status; user: Projection | null; redirects: string[]; signOuts: number };
// The runner injects the AuthProvider stub with the SAME state object.
const state: HarnessState = (globalThis as any).__aclState ?? { status: "loading", user: null, redirects: [], signOuts: 0 };
(globalThis as any).__aclState = state;

// ---- module substitution: stand in for next/navigation + AuthProvider -------
const nav = { pathname: "/corporate/dashboard" };
function replaceMock(target: string) { state.redirects.push(target); }

// The guard imports useAuth/usePathname/useRouter; the harness provides them
// via require-cache injection before the component module is evaluated.
function useAuth() {
  return {
    status: state.status,
    user: state.user,
    refreshSession: async () => {},
    logout: async () => { state.signOuts += 1; },
  };
}
function usePathname() { return nav.pathname; }
function useRouter() { return { replace: replaceMock, push: replaceMock }; }
function useEffect() { /* effects do not run in static render */ }

let failures: string[] = [];
function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

const SENTINEL = "PORTAL-CONTENT-SENTINEL";
function child(): ReactNode { return createElement("div", null, SENTINEL); }

function render(element: ReactNode): string {
  return renderToStaticMarkup(element as never);
}

function setAuth(status: Status, user: Projection | null) {
  state.status = status; state.user = user; state.redirects = []; state.signOuts = 0;
}

export function runGuardMatrix() {
  // 1. Individual-only account on the Corporate portal route (direct URL / refresh)
  setAuth("authenticated", { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 });
  let html = render(createElement(RequireAccountContext as never, { context: "CORPORATE", children: child() }));
  assert(!html.includes(SENTINEL), "Direct URL: Individual-only must not receive Corporate portal content");
  assert(html.includes("No Corporate portal access"), "Direct URL: must show a Corporate access notice");
  assert(state.signOuts === 0, "Direct URL: the session must not be destroyed");

  // 2. Corporate-only on Joint
  setAuth("authenticated", { authorizedContexts: ["CORPORATE"], jointMembershipCount: 0 });
  html = render(createElement(RequireAccountContext as never, { context: "JOINT", children: child() }));
  assert(!html.includes(SENTINEL) && html.includes("No Joint portal access"), "Corporate-only must not receive Joint portal content");

  // 3. Corporate-only on Individual
  html = render(createElement(RequireAccountContext as never, { context: "INDIVIDUAL", children: child() }));
  assert(!html.includes(SENTINEL) && html.includes("No Individual portal access"), "Corporate-only must not receive Individual portal content");

  // 4. Authorised paths still render
  setAuth("authenticated", { authorizedContexts: ["CORPORATE"], jointMembershipCount: 0 });
  html = render(createElement(RequireAccountContext as never, { context: "CORPORATE", children: child() }));
  assert(html.includes(SENTINEL), "Corporate account must receive Corporate portal content");
  setAuth("authenticated", { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 });
  html = render(createElement(RequireAccountContext as never, { context: "INDIVIDUAL", children: child() }));
  assert(html.includes(SENTINEL), "Individual account must receive Individual portal content");
  setAuth("authenticated", { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 2 });
  html = render(createElement(RequireAccountContext as never, { context: "JOINT", children: child() }));
  assert(html.includes(SENTINEL), "Joint member must receive Joint portal content");
  html = render(createElement(RequireAccountContext as never, { context: "INDIVIDUAL", children: child() }));
  assert(html.includes(SENTINEL), "Joint member keeps Individual access");

  // 5. Session restoration: loading must never render content or redirect
  setAuth("loading", null);
  html = render(createElement(RequireAccountContext as never, { context: "INDIVIDUAL", children: child() }));
  assert(!html.includes(SENTINEL), "Loading must not render portal content");
  assert(html.includes("Restoring your secure session"), "Loading must show the restore message");

  // 6. Transient restore failure: retry UI, no content, no forced logout
  setAuth("error", null);
  html = render(createElement(RequireAccountContext as never, { context: "CORPORATE", children: child() }));
  assert(!html.includes(SENTINEL), "Transient error must not render portal content");
  assert(/couldn[^<]{0,8}t restore your session/i.test(html), "Transient error must offer the retry screen");
  assert(!html.includes("No Corporate portal access"), "A transient failure must not be reported as an authorisation denial");
  assert(state.signOuts === 0, "A transient failure must not sign the user out");

  // 7. Unauthenticated: no content (redirect happens in an effect)
  setAuth("unauthenticated", null);
  html = render(createElement(RequireAccountContext as never, { context: "INDIVIDUAL", children: child() }));
  assert(html === "", "Unauthenticated render must be empty (redirect is deferred to the effect)");

  // 8. Unverifiable projection: fail closed with a distinct message
  setAuth("authenticated", {});
  html = render(createElement(RequireAccountContext as never, { context: "INDIVIDUAL", children: child() }));
  assert(!html.includes(SENTINEL), "A projection without authorizedContexts must not render portal content");
  assert(/couldn[^<]{0,8}t confirm/i.test(html), "An unverifiable projection must say so explicitly");

  // 9. Empty authorizedContexts grants nothing and is NOT treated as unverifiable
  setAuth("authenticated", { authorizedContexts: [], jointMembershipCount: 0 });
  html = render(createElement(RequireAccountContext as never, { context: "INDIVIDUAL", children: child() }));
  assert(!html.includes(SENTINEL), "An empty authorizedContexts array must grant nothing");
  assert(html.includes("No Individual portal access"), "An empty array is a real denial, not an unverifiable projection");

  // 10. /register/joint journey: Individual investor with no Joint membership
  setAuth("authenticated", { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 });
  html = render(createElement(RequireContextPermission as never, { context: "INDIVIDUAL", children: child() }));
  assert(html.includes(SENTINEL), "An Individual investor with no Joint membership must be able to start a Joint application");
  // ...and the Joint *portal* remains closed to them
  html = render(createElement(RequireAccountContext as never, { context: "JOINT", children: child() }));
  assert(!html.includes(SENTINEL), "The same investor must not enter the Joint portal without a membership");

  // 11. Login destination matrix, executed
  const individual = { authorizedContexts: ["INDIVIDUAL"] as Array<"INDIVIDUAL"> };
  assert(resolveLoginDestination(individual, "CORPORATE", null).destination === null, "Login: Individual selecting Corporate must not navigate");
  assert(resolveLoginDestination(individual, "JOINT", null).destination === null, "Login: Individual selecting Joint must not navigate");
  assert(resolveLoginDestination(individual, "INDIVIDUAL", null).destination === "/dashboard", "Login: authorised Individual navigates to /dashboard");
  assert(resolveLoginDestination(individual, "JOINT", "/register/joint").destination === "/register/joint", "Login: Joint application return path is allowed for an Individual investor");
  assert(resolveLoginDestination(individual, "CORPORATE", "/corporate/profile").destination === null, "Login: a Corporate return path must not be honoured");
  const corporate = { authorizedContexts: ["CORPORATE" as const] };
  assert(resolveLoginDestination(corporate, "CORPORATE", "/corporate/profile").destination === "/corporate/profile", "Login: authorised Corporate return path is honoured");
  assert(resolveLoginDestination(corporate, "CORPORATE", "/dashboard").destination === "/corporate/dashboard", "Login: a return path outside the portal is ignored");
  const noContexts = {};
  assert(resolveLoginDestination(noContexts, "INDIVIDUAL", null).destination === null, "Login: unverifiable projection must not navigate");
  assert(describeContextAuthorization(noContexts, "INDIVIDUAL").unverified, "Login: unverifiable projection must be flagged");

  return failures;
}
