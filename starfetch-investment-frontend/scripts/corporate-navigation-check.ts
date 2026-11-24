import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getJointRegistrationEntryAction } from "../lib/auth/joint-registration-entry";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sidebar = read("components/corporate/CorporateSidebar.tsx");
const quickActions = read("components/corporate/CorporateQuickActions.tsx");
const ui = read("components/ui.tsx");
const authProvider = read("components/auth/AuthProvider.tsx");
const guard = read("components/auth/RequireIndividualAuth.tsx");
const corporateLayout = read("app/corporate/layout.tsx");
const client = read("lib/api/client.ts");
const corporateKycPrompt = read("components/corporate/CorporateKycPrompt.tsx");
const individualKycPrompt = read("components/portal/IndividualKycPrompt.tsx");

// --- Corporate navigation uses client-side routing (no full reloads) ---
assert(sidebar.includes('from "next/link"') && sidebar.includes("<Link"), "Corporate sidebar must use next/link");
assert(!sidebar.includes("<a key={label}"), "Corporate sidebar must not use native anchors for portal tabs");
for (const href of ["/corporate/dashboard", "/corporate/investments", "/corporate/transactions", "/corporate/products", "/corporate/profile"]) {
  assert(sidebar.includes(href) || read("components/corporate/corporate-dashboard-data.ts").includes(href), `Corporate navigation must include ${href}`);
}
assert(!sidebar.includes('href="/dashboard"') && !sidebar.includes('href="/profile"'), "Corporate sidebar must never link to Individual routes");
assert(quickActions.includes('from "next/link"') && quickActions.includes("<Link"), "Corporate quick actions must use next/link");
assert(ui.includes('from "next/link"') && ui.includes("<Link href={href}"), "Logo and Button must use next/link so internal clicks preserve the in-memory session");

// --- Session architecture preserved ---
assert(client.includes("let inMemoryAccessToken"), "Access token must remain in-memory");
assert(!/localStorage\s*\.\s*setItem|sessionStorage\s*\.\s*setItem/.test(client), "Tokens must never be written to browser storage");
assert(client.includes('credentials: "include"'), "Requests must keep HttpOnly cookie credentials");
assert(client.includes("X-CSRF-Token"), "CSRF protection must be preserved");
assert(client.includes("refreshInFlight"), "Refresh single-flight must be preserved");

// --- Redirect only on backend-confirmed unauthenticated ---
assert(authProvider.includes('error.code === "UNAUTHENTICATED"'), "Session restore must distinguish backend-confirmed UNAUTHENTICATED");
assert(authProvider.includes('setStatus("error")'), "Transient restore failures must surface a retryable error, not logout");
assert(authProvider.includes("hasAccessToken()"), "Transient re-refresh failures must preserve an existing authenticated session");
assert(guard.includes('status === "unauthenticated"') && guard.includes("router.replace"), "Guard must redirect only when unauthenticated");
assert(guard.includes('status === "loading"') && guard.includes("Restoring your secure session"), "Guard must show loading while restoring, never redirect early");
assert(guard.includes('status === "error"') && guard.includes("refreshSession"), "Guard must offer retry on transient restore failure");
assert(
  corporateLayout.includes("RequireAccountContext") && corporateLayout.includes('context="CORPORATE"'),
  "Corporate layout must guard the CORPORATE context (authenticated session + backend-proven Corporate access)",
);

// --- Joint entry treats restore error as wait (never continue/explain) ---
assert(getJointRegistrationEntryAction("error") === "wait", "Joint entry must wait on session restore error");

// --- KYC popups preserved and separated ---
assert(corporateKycPrompt.includes('href="/corporate/profile"'), "Corporate KYC popup must link to /corporate/profile");
assert(!corporateKycPrompt.includes('href="/profile"'), "Corporate KYC popup must never link to /profile");
assert(individualKycPrompt.includes('href="/profile"'), "Individual KYC popup must link to /profile");
assert(!individualKycPrompt.includes('href="/corporate/profile"'), "Individual KYC popup must never link to /corporate/profile");

console.log("PASS — Corporate navigation uses client-side routing, session restore redirects only on backend-confirmed expiry, and KYC popups stay separated");
