/**
 * JOINT ACCESS REGRESSION — RUNTIME test of the ACTUAL guard component.
 *
 * Every assertion here renders the real RequireAccountContext through
 * react-dom/server with the Next router and the AuthProvider hook substituted.
 * The component under test is the shipped one, not a copy of its logic.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequireAccountContext } from "../../components/auth/RequireIndividualAuth";

type Projection = { authorizedContexts?: Array<"INDIVIDUAL" | "JOINT" | "CORPORATE">; jointMembershipCount?: number };
const state: { status: "loading" | "authenticated" | "unauthenticated" | "error"; user: Projection | null; pathname: string } =
  (globalThis as any).__aclState ?? { status: "loading", user: null, pathname: "/joint/dashboard" };
(globalThis as any).__aclState = state;

const SENTINEL = "JOINT-PAGE-CONTENT";
function child(): ReactNode { return createElement("div", null, SENTINEL); }
function render(context: "INDIVIDUAL" | "JOINT" | "CORPORATE", pathname: string, user: Projection | null) {
  state.status = "authenticated";
  state.user = user;
  state.pathname = pathname;
  return renderToStaticMarkup(createElement(RequireAccountContext as never, { context, children: child() }));
}

export function runJointRegressionMatrix() {
  const failures: string[] = [];
  const check = (condition: boolean, message: string) => { if (!condition) failures.push(message); };

  const individualOnly: Projection = { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 };
  const jointMember: Projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
  const corporateOnly: Projection = { authorizedContexts: ["CORPORATE"], jointMembershipCount: 0 };

  // --- 1. Individual-only user opening a Joint invitation -------------------
  const inbox = render("JOINT", "/joint/invitations", individualOnly);
  check(inbox.includes(SENTINEL), "REGRESSION: an Individual-only investor must be able to open /joint/invitations");
  check(!inbox.includes("No Joint portal access"), "The invitation inbox must not show a Joint access denial for an Individual investor");

  // --- 2. Everything else in the Joint portal stays closed to them ----------
  for (const route of ["/joint/dashboard", "/joint/investments", "/joint/transactions", "/joint/profile", "/joint/products", "/joint/products/fixed-note"]) {
    const html = render("JOINT", route, individualOnly);
    check(!html.includes(SENTINEL), `An Individual-only investor must NOT receive ${route}`);
    check(html.includes("No Joint portal access"), `${route} must show the Joint access notice`);
  }

  // --- 3. A real Joint member keeps full access ----------------------------
  for (const route of ["/joint/dashboard", "/joint/invitations", "/joint/profile"]) {
    const html = render("JOINT", route, jointMember);
    check(html.includes(SENTINEL), `A Joint member must receive ${route}`);
  }

  // --- 4. Corporate-only accounts get no invitation inbox ------------------
  const corporateInbox = render("JOINT", "/joint/invitations", corporateOnly);
  check(!corporateInbox.includes(SENTINEL), "A Corporate-only account must not receive the Joint invitation inbox");

  // --- 5. Unverifiable projection still fails closed everywhere -----------
  const unverifiableInbox = render("JOINT", "/joint/invitations", {});
  check(!unverifiableInbox.includes(SENTINEL), "An unverifiable projection must not open the invitation inbox");
  check(/couldn[^<]{0,8}t confirm/i.test(unverifiableInbox), "An unverifiable projection must say access could not be confirmed");

  // --- 6. Empty contexts is a real denial, not an unverifiable one --------
  const emptyInbox = render("JOINT", "/joint/invitations", { authorizedContexts: [] });
  check(!emptyInbox.includes(SENTINEL), "An empty authorizedContexts must not open the invitation inbox");

  // --- 7. Individual portal rules unchanged -------------------------------
  const individualDashboard = render("INDIVIDUAL", "/dashboard", individualOnly);
  check(individualDashboard.includes(SENTINEL), "An Individual investor still gets /dashboard");
  const corporateOnIndividual = render("INDIVIDUAL", "/dashboard", corporateOnly);
  check(!corporateOnIndividual.includes(SENTINEL), "A Corporate-only account still cannot open /dashboard");

  return failures;
}
