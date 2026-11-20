/**
 * Corporate Profile integration (static) check. Replaces the retired
 * local-only check now that the page loads from and saves to the owner-scoped
 * Corporate Profile API. Behavioural HTTP contract coverage lives in
 * scripts/corporate-profile-api-check.ts (mocked fetch only).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { corporateInvestmentHorizonOptions, corporateInvestmentObjectives, corporateRiskToleranceOptions, corporateSourceOfFundsOptions } from "../lib/corporate/profile";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const profile = read("components/corporate/CorporateProfileContent.tsx");
const client = read("lib/api/client.ts");
const contract = read("lib/corporate/profile.ts");

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

// Supplied form option lists are unchanged (and identical to the backend enums).
assert(corporateInvestmentObjectives.join("|") === "Capital preservation|Income|Balanced|Growth", "Corporate investment objective options must match the supplied form");
assert(corporateRiskToleranceOptions.join("|") === "Conservative|Moderate|Balanced|Aggressive", "Corporate risk options must match the supplied form");
assert(corporateInvestmentHorizonOptions.join("|") === "< 1 year|1–3 years|3–5 years|5 years +", "Corporate horizons must match the supplied Corporate form image");
assert(corporateSourceOfFundsOptions.join("|") === "Business income / operating cash|Sale of assets|Loan / financing|Other (specify)", "Corporate source-of-funds options must match the supplied form image");

// Fields and read-only identity are unchanged.
assert(profile.includes("Corporate applicant information") && profile.includes("Company name") && profile.includes("Company phone number") && profile.includes("Account email"), "Corporate applicant information must appear in the profile");
assert(profile.includes("applicantInfo(user, profile)") && profile.includes("Not recorded for this account"), "Read-only identity must come from the backend profile/session projection and show clearly when absent");
assert(!/name="(?:companyName|companyPhoneNumber|email)"/.test(profile), "Account-managed identity must not have editable section controls");
for (const field of ["rcNumber", "dateOfIncorporation", "taxIdentificationNumber", "registeredAddress", "city", "state"]) assert(profile.includes(`name="${field}"`), `Company details field ${field} is missing`);
for (const field of ["primaryObjective", "riskTolerance", "investmentHorizon", "expectedWithdrawals", "withdrawalFrequency", "restrictionsOrExclusions"]) assert(profile.includes(`name="${field}"`) || profile.includes(`name={"${field}"}`), `Investment Profile field ${field} is missing`);
for (const field of ["selectedSources", "otherSource", "expectedAnnualInflow", "expectedTransactionFrequency"]) assert(profile.includes(field), `Source of Funds field ${field} is missing`);
for (const field of ["bankName", "accountNumber", "accountName", "accountType", "bvnLinkedToAccount"]) assert(profile.includes(field), `Bank Details field ${field} is missing`);
assert(profile.includes("BVN linked to this account?") && !profile.includes('name="bvn"') && !profile.includes("Branch / sort code") && !profile.includes("sortCode"), "Bank Details may ask for BVN-linked confirmation but not raw BVN, Branch, or sort-code fields");

// API wiring: discovery first, then the profile read, then per-section saves.
assert(client.includes("export async function getCorporateProfile(") && client.includes("/profile`"), "client.ts must expose the Corporate Profile GET");
for (const [fn, route] of [["saveCorporateProfileCompanyDetails", "/profile/company-details"], ["saveCorporateProfileInvestmentProfile", "/profile/investment-profile"], ["saveCorporateProfileSourceOfFunds", "/profile/source-of-funds"], ["saveCorporateProfileBankDetails", "/profile/bank-details"]] as const) {
  assert(client.includes(`export async function ${fn}(`) && client.includes(route), `client.ts must expose ${fn} for ${route}`);
  assert(profile.includes(`${fn}(`), `The Corporate Profile must save through ${fn}`);
}
assert(client.includes('"/me/corporate-applicant-profile"') && profile.includes("completeCorporateApplicantIdentity("), "Legacy identity completion must use PATCH /me/corporate-applicant-profile");
assert(/authenticatedMutation\(`\/corporate-accounts\/\$\{corporateAccountPathSegment\(corporateAccountId\)\}\/profile\/company-details`[^;]*"PATCH"\)/.test(client), "Profile writes must use authenticatedMutation (bearer + CSRF + refresh) with PATCH");
assert(profile.indexOf("await getMyCorporateApplications()") > -1 && profile.indexOf("await getMyCorporateApplications()") < profile.indexOf("await getCorporateProfile("), "The profile must be loaded only for an account returned by owner-scoped discovery");
assert(profile.includes("accounts[0] ?? null") && profile.includes("No Corporate application is available yet"), "No discovered application must show an empty state, never an invented account");
assert(!/\bfetch\s*\(/.test(profile) && !/\/me\/(?:portfolio|transactions|kyc-profile)/.test(profile), "The component must not call fetch directly or reuse Individual endpoints");

// Backend state drives completion, unlocking and progress.
assert(profile.includes("sectionStatuses[section.key] === \"COMPLETE\"") && profile.includes("profile.progress.percentage"), "Section completion and progress must come from backend sectionStatuses/progress");
assert(profile.includes("profileVersion: profile.profileVersion, detailsVersion: profile.detailsVersion") && profile.includes("profile.profileVersion,"), "Saves must send the latest profileVersion/detailsVersion");
assert(profile.includes("applyProfile(saved") && profile.includes("error.code === \"CONFLICT\"") && profile.includes("await loadProfile(ownerId, { keepNotice: true })") && profile.includes("review it before saving again"), "A save must refresh from the response, and a 409 must reload and ask the user to review");
assert(profile.includes("isCorporateDraftEditable(account.status)") && profile.includes("Editing unavailable"), "Non-editable application states must not offer saving");

// Sensitive values: write-only, never prefilled, cleared, never stored or logged.
assert(profile.includes('taxIdentificationNumber: "",') && profile.includes('accountNumber: "",'), "TIN and account number inputs must never be prefilled from a response");
assert(profile.includes("taxIdentificationNumberMasked") && profile.includes("accountNumberMasked"), "Only backend-masked TIN/account projections may be displayed");
assert(profile.includes("...(tinEntered ? { taxIdentificationNumber:") && client.includes("...(tin ? { taxIdentificationNumber: tin } : {})"), "A blank TIN must be omitted so the stored TIN is retained");
assert(profile.includes('setBank((current) => ({ ...current, accountNumber: "" }))') && profile.includes('setCompany((current) => ({ ...current, taxIdentificationNumber: "" }))'), "Sensitive inputs must be cleared after a rejected save");
assert(!/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(profile) && !/\bconsole\.(?:log|info|warn|error|debug)\b/.test(profile), "Corporate Profile values must never be written to browser storage or logged");
assert(contract.includes("taxIdentificationNumberMasked: string | null") && contract.includes("accountNumberMasked: string | null") && !/CorporateProfileView = \{[\s\S]*?\btaxIdentificationNumber: string/.test(contract.split("export type CorporateProfileCompanyDetailsInput")[0]), "The backend view type must contain only masked sensitive projections");

// Truthful status messaging; no local-only claims remain.
for (const stale of ["not sent to or saved by the backend", "cleared when you leave or refresh", "Mark complete for this session", "Local-only form", "this page session only", "Nothing was sent or saved to the backend"]) assert(!profile.includes(stale), `Inaccurate local-only text remains: “${stale}”`);
assert(profile.includes("Loading your saved Corporate Profile…") && profile.includes("Saving…") && profile.includes("saved to your Corporate application") && profile.includes("Nothing was saved"), "Loading, saving, success and failure states must be truthful");
assert(profile.includes("secure bank-account encryption is currently unavailable") && profile.includes("secure Corporate TIN processing is currently unavailable"), "KMS/privacy-gate 503s must be explained and never shown as success");
assert(profile.includes("does not represent KYC/KYB verification, approval, or investment authorisation") || profile.includes("does not represent Corporate verification or approval"), "Saved-form completion must not be presented as verification or approval");
assert(profile.includes("errorReference(error)") && client.includes("requestId"), "Load/save failures must expose a safe support reference with the backend requestId");

console.log("PASS — Corporate Profile loads via discovery→GET, saves each section through the authenticated PATCH client, follows backend statuses/versions, reloads on 409, keeps TIN/account number write-only and masked, and shows truthful states");
