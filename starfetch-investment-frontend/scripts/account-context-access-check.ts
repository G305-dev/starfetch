/**
 * Safe account-type access control — STATIC wiring check.
 *
 * This asserts the shipped source is wired correctly. Execution of the guard
 * components, the login resolver and the REAL AuthProvider lives in
 * scripts/harness/ and is run by:
 *   npm run test:account-context-access:runtime   (guards, Joint rules, module)
 *   npm run test:access-control:provider          (REAL AuthProvider + forms)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  authorizedPortals,
  canStartJointApplication,
  isJointInvitationInboxPath,
  isJointPathAllowed,
  describeContextAuthorization,
  isContextAuthorized,
  isJointApplicationPath,
  isJointJourneyPathAuthorized,
  loginTypeToPortal,
  pathBelongsToContext,
  portalDashboards,
  resolveLoginDestination,
} from "../lib/auth/account-context-access";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const signIn = stripComments(read("components/auth/SignInForm.tsx"));
const guard = stripComments(read("components/auth/RequireIndividualAuth.tsx"));
const accessSource = read("lib/auth/account-context-access.ts");
const client = stripComments(read("lib/api/client.ts"));
const dashboardLayout = read("app/dashboard/layout.tsx");
const corporateLayout = read("app/corporate/layout.tsx");
const jointLayout = read("app/joint/layout.tsx");
const jointPortalAccess = read("components/joint/JointPortalAccess.tsx");
const jointRegistrationPage = read("app/register/joint/page.tsx");

// ------------------------------------------------------- package.json integrity
const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
for (const [name, command] of Object.entries(pkg.scripts)) {
  // Alternation is ordered longest-first. With `ts` before `tsx` the engine stops
  // at `…check.ts` and reports a `.tsx` script as missing — a latent bug that only
  // surfaces once a script file uses the `.tsx` extension.
  for (const referenced of command.match(/scripts\/[\w./-]+\.(tsx|ts|cjs|js)/g) ?? []) {
    assert(existsSync(join(root, referenced)), `package.json script "${name}" references a missing file: ${referenced}`);
  }
}
assert(Boolean(pkg.scripts["test:account-context-access"]), "test:account-context-access must be registered");
assert(existsSync(join(root, "scripts/account-context-access-check.ts")), "The registered account-context check must exist");
assert(existsSync(join(root, "scripts/harness/account-context-runtime-check.tsx")), "The runtime guard harness must exist");
assert(existsSync(join(root, "scripts/harness/login-flow-runtime-check.tsx")), "The runtime login harness must exist");

// ---------------------------------------------------------------- projections
type Projection = { authorizedContexts?: Array<"INDIVIDUAL" | "JOINT" | "CORPORATE">; jointMembershipCount?: number };
const individualOnly: Projection = { authorizedContexts: ["INDIVIDUAL"], jointMembershipCount: 0 };
const individualWithJoint: Projection = { authorizedContexts: ["INDIVIDUAL", "JOINT"], jointMembershipCount: 1 };
const corporateOnly: Projection = { authorizedContexts: ["CORPORATE"], jointMembershipCount: 0 };
const dualContext: Projection = { authorizedContexts: ["INDIVIDUAL", "CORPORATE"], jointMembershipCount: 0 };
const jointOnly: Projection = { authorizedContexts: ["JOINT"], jointMembershipCount: 2 };
// An account that is genuinely both an Individual investor and a Corporate applicant.
const individualAndCorporate: Projection = { authorizedContexts: ["INDIVIDUAL", "CORPORATE"], jointMembershipCount: 0 };
const emptyContexts: Projection = { authorizedContexts: [], jointMembershipCount: 0 };
const unverifiable: Projection = {};

// ------------------------------------------------------- the six required cases
assert(isContextAuthorized(individualOnly, "INDIVIDUAL"), "Individual logs into Individual successfully");
assert(!isContextAuthorized(individualOnly, "CORPORATE"), "Individual-only cannot access Corporate");
assert(!isContextAuthorized(individualOnly, "JOINT"), "Individual-only cannot access Joint");
assert(isContextAuthorized(corporateOnly, "CORPORATE"), "Corporate logs into Corporate successfully");
assert(!isContextAuthorized(corporateOnly, "INDIVIDUAL"), "Corporate-only cannot access Individual");
assert(!isContextAuthorized(corporateOnly, "JOINT"), "Corporate-only cannot access Joint");
assert(isContextAuthorized(individualWithJoint, "JOINT"), "Authorized Joint member logs into Joint successfully");
assert(isContextAuthorized(individualWithJoint, "INDIVIDUAL"), "A Joint member keeps Individual access");

// ------------------------------------------------- multiple / mixed contexts
assert(authorizedPortals(individualWithJoint).join() === "INDIVIDUAL,JOINT", "Multiple contexts all remain usable");
assert(authorizedPortals(dualContext).join() === "INDIVIDUAL,CORPORATE", "Dual Individual/Corporate keeps both portals");
assert(authorizedPortals(jointOnly).join() === "JOINT", "Joint-only grants only Joint");

// ------------------------------------- fail closed where unprovable (requirement 4)
assert(!isContextAuthorized(unverifiable, "INDIVIDUAL") && !isContextAuthorized(unverifiable, "CORPORATE") && !isContextAuthorized(unverifiable, "JOINT"), "A projection without authorizedContexts grants nothing");
assert(!isContextAuthorized(null, "INDIVIDUAL"), "No authenticated user grants nothing");
assert(describeContextAuthorization(unverifiable, "CORPORATE").unverified, "An unprovable projection must be flagged as unverified");
assert(describeContextAuthorization(individualOnly, "CORPORATE").unverified === false, "A classified denial is not an 'unverified' projection");
assert(!isContextAuthorized(emptyContexts, "INDIVIDUAL"), "An explicitly empty authorizedContexts must grant nothing");
// The legacy fallback is deliberately REMOVED: primaryAccountType must not appear in the decision path.
// Only a doc-comment may mention it; the decision code must not read it.
const accessCode = stripComments(accessSource);
assert(!accessCode.includes("primaryAccountType"), "The access helper must not consult primaryAccountType (backend /me always supplies authorizedContexts)");
assert(accessSource.includes("fails closed"), "The helper must document that an absent projection fails closed");

// --------------------------------- never trust the account-type selection
for (const portal of Object.values(loginTypeToPortal)) {
  if (portal !== "INDIVIDUAL") assert(resolveLoginDestination(individualOnly, portal, null).destination === null, `Selecting ${portal} must not navigate an Individual-only account`);
}
assert(resolveLoginDestination(individualOnly, "INDIVIDUAL", null).destination === "/dashboard", "Authorised Individual navigates to /dashboard");
assert(resolveLoginDestination(individualWithJoint, "JOINT", null).destination === "/joint/dashboard", "Authorised Joint navigates to /joint/dashboard");
assert(resolveLoginDestination(corporateOnly, "CORPORATE", null).destination === "/corporate/dashboard", "Authorised Corporate navigates to /corporate/dashboard");
assert(resolveLoginDestination(individualOnly, "CORPORATE", "/corporate/profile").destination === null, "A Corporate return path is not honoured for an unauthorised account");
assert(resolveLoginDestination(corporateOnly, "CORPORATE", "/corporate/profile").destination === "/corporate/profile", "An authorised Corporate return path is honoured");
assert(resolveLoginDestination(corporateOnly, "CORPORATE", "/dashboard").destination === "/corporate/dashboard", "A return path outside the selected portal is ignored");
assert(resolveLoginDestination(unverifiable, "INDIVIDUAL", null).destination === null, "An unprovable projection must not navigate");

// --------------------------- requirement 5: Individual may start a Joint application
assert(canStartJointApplication(individualOnly), "An Individual investor without a Joint membership can start a Joint application");
assert(canStartJointApplication(individualWithJoint), "A Joint member can still start another Joint application");
assert(!canStartJointApplication(corporateOnly), "A Corporate-only account cannot start a Joint application");
assert(resolveLoginDestination(individualOnly, "JOINT", "/register/joint").destination === "/register/joint", "The Joint application journey is not blocked");
assert(isJointApplicationPath("/register/joint") && !isJointApplicationPath("/joint/dashboard"), "Only /register/joint is the application journey");

// ------------------------------------------------------------- route scoping
assert(pathBelongsToContext("/corporate/profile", "CORPORATE") && !pathBelongsToContext("/corporate/profile", "INDIVIDUAL"), "Corporate routes belong to Corporate");
assert(pathBelongsToContext("/joint/dashboard", "JOINT") && !pathBelongsToContext("/joint/dashboard", "INDIVIDUAL"), "Joint routes belong to Joint");
assert(pathBelongsToContext("/profile", "INDIVIDUAL") && pathBelongsToContext("/products/fixed-note", "INDIVIDUAL"), "Individual routes belong to Individual");
assert(!pathBelongsToContext("/about", "INDIVIDUAL"), "Public marketing routes are not Individual-only");
assert(portalDashboards.CORPORATE === "/corporate/dashboard" && portalDashboards.JOINT === "/joint/dashboard" && portalDashboards.INDIVIDUAL === "/dashboard", "Portal dashboards match existing routes");

// ------------------------------------------------- unchanged-behaviour guards
assert(client.includes("jointMembershipCount"), "The client normalises the backend jointMembershipCount");
assert(!/localStorage\.|sessionStorage\./.test(accessSource + guard), "Authorisation must never be cached in browser storage");
assert(signIn.includes("resolveLoginDestination(authenticatedUser,") && signIn.includes("loginTypeToPortal[accountType]"), "Login resolves its destination from the backend projection");
assert(signIn.includes("Account access") && signIn.includes("You are still signed in"), "An unauthorised selection shows a notice and preserves the session");
assert(!/router\.replace\((?:safeNextPath|defaultDestination)/.test(signIn), "Login never navigates from the raw selection or raw return path");
// AuthProvider must be untouched: tokens, refresh, CSRF, logout, storage.
const authProvider = stripComments(read("components/auth/AuthProvider.tsx"));
assert(authProvider.includes("refreshAccessToken") && authProvider.includes("getCurrentUser") && authProvider.includes("logoutSession"), "AuthProvider session mechanics are intact");
assert(authProvider.includes('error') && authProvider.includes("hasAccessToken()"), "AuthProvider keeps the transient-error and existing-token protection");
assert(!/localStorage|sessionStorage/.test(authProvider), "AuthProvider must not persist tokens to browser storage");
// Guard keeps the three restore branches.
assert(guard.includes('status === "loading"') && guard.includes('status === "error"') && guard.includes("Restoring your secure session"), "Guard keeps loading and restore-error handling");
assert(guard.includes("router.replace(`/login?next=${encodeURIComponent(pathname)}`)"), "Only a backend-confirmed unauthenticated session redirects");
assert(dashboardLayout.includes('context="INDIVIDUAL"'), "Individual portal routes require INDIVIDUAL context");
assert(corporateLayout.includes('context="CORPORATE"'), "Corporate portal routes require CORPORATE context");
assert(jointLayout.includes('context="JOINT"'), "Joint portal routes require JOINT context");
assert(jointPortalAccess.includes('context="JOINT"'), "The Joint page guard requires JOINT context");
assert(jointRegistrationPage.includes('context="INDIVIDUAL"'), "The Joint application journey requires INDIVIDUAL context, not JOINT");

// ------------------------------------------- Joint invitation inbox (regression)
assert(isJointPathAllowed(["INDIVIDUAL"], "/joint/invitations"), "An Individual-only investor may open the Joint invitation inbox");
assert(isJointPathAllowed(["INDIVIDUAL", "JOINT"], "/joint/invitations"), "A Joint member may open the invitation inbox");
assert(!isJointPathAllowed(["CORPORATE"], "/joint/invitations"), "A Corporate-only account may not open the invitation inbox");
assert(!isJointPathAllowed([], "/joint/invitations"), "Empty contexts may not open the invitation inbox");
assert(!isJointPathAllowed(undefined, "/joint/invitations"), "An unverifiable projection may not open the invitation inbox");
for (const route of ["/joint/dashboard", "/joint/investments", "/joint/transactions", "/joint/profile", "/joint/products", "/joint/products/fixed-note"]) {
  assert(!isJointPathAllowed(["INDIVIDUAL"], route), `An Individual-only investor must not open ${route}`);
}
assert(isJointInvitationInboxPath("/joint/invitations") && !isJointInvitationInboxPath("/joint/invitations/x"), "Only the exact inbox route is exempt");
assert(resolveLoginDestination(individualOnly, "JOINT", "/joint/invitations").destination === "/joint/invitations", "A post-login return to the invitation inbox is allowed for an Individual investor");
assert(resolveLoginDestination(individualOnly, "JOINT", "/joint/dashboard").destination === null, "A post-login return to the Joint dashboard is still refused");
assert(resolveLoginDestination(corporateOnly, "JOINT", "/joint/invitations").destination === null, "A Corporate-only account gets no invitation-inbox return");
// V4: a Joint return path must never override an unauthorised Corporate selection.
assert(resolveLoginDestination(individualAndCorporate, "CORPORATE", "/joint/invitations").destination === "/corporate/dashboard", "A Joint return path must not hijack a Corporate selection");
assert(resolveLoginDestination(individualOnly, "CORPORATE", "/joint/invitations").destination === null, "A Joint return path must never grant an unauthorised Corporate selection");
assert(resolveLoginDestination(individualOnly, "INDIVIDUAL", "/register/joint").destination === "/register/joint", "/register/joint stays available to an Individual investor");
assert(resolveLoginDestination(jointOnly, "JOINT", "/register/joint").destination === null, "/register/joint needs INDIVIDUAL context, not JOINT");
// Login and the guards must share ONE rule, not two copies.
assert(isJointJourneyPathAuthorized(["INDIVIDUAL"], "/joint/invitations") === isJointPathAllowed(["INDIVIDUAL"], "/joint/invitations"), "The invitation inbox rule must be identical in the resolver and the guard");
assert(isJointJourneyPathAuthorized(["JOINT"], "/register/joint") === false, "A Joint-only account may not start a Joint application");

// ------------------------------- membership-change refresh (before navigation)
const refreshModule = stripComments(read("lib/auth/membership-context-refresh.ts"));
assert(refreshModule.includes("SessionRefreshOutcome"), "The refresh must consume AuthProvider's own refresh outcome");
assert(refreshModule.includes("resolveMembershipContextRefresh"), "The refresh must map the provider outcome through one explicit function");
// V4 core guarantee: authorisation is read from the provider's committed state,
// never from a second, independent /me read.
assert(!/getCurrentUser|refreshAccessToken|logoutSession|document\.cookie|fetch\(/.test(refreshModule), "The refresh must not make its own /me request or reimplement token/cookie/logout logic");
// Exact statement, not a fuzzy match: any non-committed outcome must return
// exactly { status: "stale" }. A looser pattern silently accepted the V3 bug.
assert(refreshModule.includes('if (outcome.status !== "refreshed") return { status: "stale" };'), "Any provider outcome that is not a committed refresh must fail closed as stale");
assert(refreshModule.includes('Array.isArray(outcome.user.authorizedContexts)'), "The committed projection must actually carry authorizedContexts");
assert(refreshModule.includes('"stale"') && refreshModule.includes('"unauthenticated"'), "A failed re-read must be reported as stale so a successful membership change is preserved");
assert(refreshModule.includes("STALE_CONTEXT_MESSAGE") && refreshModule.includes("UNAUTHENTICATED_CONTEXT_MESSAGE"), "Stale and ended-session cases need distinct user copy");
const invitationContent = stripComments(read("components/joint/JointInvitationsContent.tsx"));
assert(invitationContent.includes("refreshContextsAfterMembershipChange(refreshSession)"), "Accepting an invitation must refresh contexts before navigating");
assert(invitationContent.indexOf("acceptJointInvitation(") < invitationContent.indexOf("refreshContextsAfterMembershipChange("), "The acceptance must happen once, before the refresh, and never be repeated");
assert(invitationContent.indexOf("refreshContextsAfterMembershipChange(") < invitationContent.indexOf('router.push("/joint/dashboard")'), "Contexts must be refreshed BEFORE navigating to the Joint dashboard");
assert(invitationContent.includes("STALE_CONTEXT_MESSAGE"), "A stale refresh must still confirm the acceptance succeeded");
assert(invitationContent.includes("retryContextRefresh") && invitationContent.indexOf("acceptJointInvitation(") < invitationContent.indexOf("retryContextRefresh"), "Retrying permission refresh must be a separate action from accepting");
const retryFn = invitationContent.slice(invitationContent.indexOf("async function retryContextRefresh"), invitationContent.indexOf("if (invitationsStatus"));
assert(!retryFn.includes("acceptJointInvitation"), "The retry must never repeat the invitation acceptance");
assert(retryFn.includes("refreshContextsAfterMembershipChange(refreshSession)"), "The retry must re-read permission only");
const createForm = stripComments(read("components/auth/JointApplicantDetailsForm.tsx"));
assert(createForm.includes("refreshContextsAfterMembershipChange(refreshSession)"), "Creating a Joint account must refresh contexts");
assert(createForm.indexOf("createJointAccount(") < createForm.indexOf("refreshContextsAfterMembershipChange("), "The creation must happen once, before the refresh");
assert(createForm.includes("canEnterJointPortal("), "The Open Joint Accounts action must depend on the refreshed authorisation");
const createRetry = createForm.slice(createForm.indexOf("async function retryContextRefresh"), createForm.indexOf("if (created)"));
assert(!createRetry.includes("createJointAccount("), "Retrying permission refresh must never create a second Joint account");
assert(createRetry.includes("refreshContextsAfterMembershipChange(refreshSession)"), "The creation retry must re-read permission only");
// AuthProvider must still be untouched by these flows.
const providerSrc = stripComments(read("components/auth/AuthProvider.tsx"));
assert(!providerSrc.includes("refreshContextsAfterMembershipChange"), "AuthProvider must not gain membership-refresh logic");
// The provider reports what it committed so no caller needs a second /me read.
assert(providerSrc.includes('return { status: "refreshed", user: currentUser }'), "AuthProvider must return the projection it actually committed");
assert(providerSrc.includes('return { status: "superseded" }'), "A superseded refresh must not be reported as committed");
assert(providerSrc.includes('return { status: "unauthenticated" }'), "Only a backend-confirmed UNAUTHENTICATED is a session end");
// Token/cookie/CSRF/logout behaviour must remain exactly as shipped.
assert(providerSrc.includes("refreshAccessToken()") && providerSrc.includes("logoutSession()") && providerSrc.includes("clearAccessToken()"), "AuthProvider token/logout mechanics are unchanged");
assert(!/document\.cookie|localStorage|sessionStorage/.test(providerSrc), "AuthProvider must not gain cookie or storage handling");
for (const page of ["app/investments/page.tsx", "app/transactions/page.tsx", "app/profile/page.tsx", "app/products/page.tsx", "app/products/fixed-note/page.tsx"]) {
  assert(read(page).includes('RequireAccountContext context="INDIVIDUAL"'), `${page} enforces INDIVIDUAL context on direct URL access`);
}

console.log("PASS — Account-type access control (static): authorisation derives only from backend authorizedContexts and fails closed when absent; login and every portal guard share one Joint rule; unauthorised selections and direct URLs never render portal content; Individual investors can still open invitations and start a Joint application; membership refresh reads ONLY the projection AuthProvider committed; and the token/CSRF/logout behaviour is untouched");
