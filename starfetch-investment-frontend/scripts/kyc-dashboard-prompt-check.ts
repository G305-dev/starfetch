import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TimeGreeting } from "../lib/greeting";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Keep the source check on the same project-root compilation path as its peers.
type _TimeGreetingContract = TimeGreeting;

const individualPage = read("app/dashboard/page.tsx");
const corporatePage = read("app/corporate/dashboard/page.tsx");
const individualPrompt = read("components/portal/IndividualKycPrompt.tsx");
const corporatePromptRaw = read("components/corporate/CorporateKycPrompt.tsx");
// Strip block comments so boundary comments ("never calls X") do not
// trip the endpoint-reuse assertions below; only real code is checked.
const corporatePrompt = corporatePromptRaw.replace(/\/\*[\s\S]*?\*\//g, "");
const individualRules = read("lib/individual-kyc-prompt.ts");
const client = read("lib/api/client.ts");

// --- Individual dashboard wiring ---
assert(individualPage.includes("<IndividualKycPrompt"), "Individual dashboard must render IndividualKycPrompt");
assert(individualPage.includes("RequireIndividualAuth"), "Individual dashboard must keep the authenticated boundary");
assert(individualPrompt.includes('href="/profile"'), "Individual popup Complete KYC must link to /profile");
assert(individualPrompt.includes("Complete KYC") && individualPrompt.includes("Maybe Later"), "Individual popup must offer Complete KYC and Maybe Later");
assert(individualPrompt.includes("getIndividualKycProfile"), "Individual popup must use the Individual KYC backend status");
assert(!individualPrompt.includes('href="/corporate/profile"'), "Individual popup must never link to /corporate/profile");
assert(!individualPrompt.includes("/corporate/"), "Individual popup must never reference Corporate routes");

// --- Corporate dashboard wiring ---
assert(corporatePage.includes("<CorporateKycPrompt"), "Corporate dashboard must render CorporateKycPrompt");
assert(corporatePage.includes("CorporatePortalLayout"), "Corporate dashboard must stay inside the Corporate Portal layout");
assert(corporatePrompt.includes('href="/corporate/profile"'), "Corporate popup Complete KYC must link to /corporate/profile");
assert(corporatePrompt.includes("Complete KYC") && corporatePrompt.includes("Maybe Later"), "Corporate popup must offer Complete KYC and Maybe Later");
assert(corporatePrompt.includes("useAuth"), "Corporate popup must receive the authenticated Corporate account context");
assert(corporatePrompt.includes("companyName"), "Corporate popup must display the Corporate company context");
assert(!corporatePrompt.includes('href="/profile"'), "Corporate popup must never link to /profile");
assert(!corporatePrompt.includes('href="/dashboard"'), "Corporate popup must never link to /dashboard");
assert(!corporatePrompt.includes("getIndividualKycProfile"), "Corporate popup must never call the Individual KYC endpoint");
assert(!corporatePrompt.includes("IndividualKycProfile"), "Corporate popup must never use the Individual KYC profile type");
assert(!corporatePrompt.includes("/me/kyc-profile"), "Corporate popup must never call Individual KYC submission endpoints");

// --- Individual KYC client preserved on this branch ---
assert(client.includes("export async function getIndividualKycProfile"), "Individual KYC client getIndividualKycProfile must be present");
assert(client.includes("export type IndividualKycProfile"), "Individual KYC client IndividualKycProfile must be present");
assert(client.includes("export async function getMyCorporateApplications"), "Corporate API functions must be preserved alongside Individual KYC");
assert(individualRules.includes("hasSubmittedIndividualKyc"), "Individual submitted-status rules must remain available");

// --- Both popups: accessible, dismissible, no persistence ---
for (const [label, source] of [["IndividualKycPrompt", individualPrompt], ["CorporateKycPrompt", corporatePrompt]] as const) {
  assert(source.includes('role="dialog"') && source.includes('aria-modal="true"'), `${label} must be an accessible modal`);
  assert(source.includes("setDismissed(true)"), `${label} Maybe Later must dismiss in memory`);
  assert(!/(localStorage|sessionStorage|document\.cookie)/.test(source), `${label} must not persist dismissal in browser storage`);
}

console.log("PASS — Individual and Corporate KYC popups are separated: /dashboard -> /profile and /corporate/dashboard -> /corporate/profile, with no cross-portal navigation or endpoint reuse");
