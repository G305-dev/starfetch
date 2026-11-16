import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { corporateInvestmentHorizonOptions, corporateInvestmentObjectives, corporateRiskToleranceOptions, corporateSourceOfFundsOptions } from "../lib/corporate/profile";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const profile = read("components/corporate/CorporateProfileContent.tsx");
const api = read("lib/api/client.ts");
const registration = read("components/auth/CorporateApplicantRegistrationForm.tsx");
const contract = read("lib/corporate/profile.ts");

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

assert(corporateInvestmentObjectives.join("|") === "Capital preservation|Income|Balanced|Growth", "Corporate investment objective options must match the supplied form");
assert(corporateRiskToleranceOptions.join("|") === "Conservative|Moderate|Balanced|Aggressive", "Corporate risk options must match the supplied form");
assert(corporateInvestmentHorizonOptions.join("|") === "< 1 year|1–3 years|3–5 years|5 years +", "Corporate horizons must match the supplied Corporate form image");
assert(corporateSourceOfFundsOptions.join("|") === "Business income / operating cash|Sale of assets|Loan / financing|Other (specify)", "Corporate source-of-funds options must match the supplied form image");

assert(registration.includes('name="companyName"') && registration.includes('name="companyPhoneNumber"') && registration.includes("registerCorporateApplicant({ companyName, companyPhoneNumber, email, password })"), "Corporate account creation must collect company name and company phone");
assert(profile.includes("Corporate applicant information") && profile.includes('label="Company name" value={profile.applicant.companyName}') && profile.includes('label="Company phone number" value={profile.applicant.companyPhoneNumber}') && profile.includes('label="Account email" value={profile.applicant.email}'), "Account-managed applicant identity must be shown read-only in Corporate Profile");
assert(!/name="(?:companyName|companyPhoneNumber|email)"/.test(profile), "Company identity and email must not have editable profile controls");
for (const field of ["rcNumber", "dateOfIncorporation", "taxIdentificationNumber", "registeredAddress", "city", "state"]) assert(profile.includes(`name="${field}"`), `Company details field ${field} is missing`);
for (const key of ["companyDetails", "investmentProfile", "sourceOfFunds", "bankDetails"]) assert(profile.includes(`key: "${key}"`), `Sequential Corporate Profile section ${key} is missing`);
assert(profile.includes("furthestSequentialSection") && profile.includes("index > furthestStep") && profile.includes("setActiveStep(nextStep)") && profile.includes('currentStatus !== "COMPLETE"'), "Later Corporate sections must remain locked until the backend confirms the previous section complete");
assert(profile.includes("Save draft") && profile.includes("saveCorporateCompanyDetails") && profile.includes("saveCorporateInvestmentProfile") && profile.includes("saveCorporateSourceOfFunds") && profile.includes("saveCorporateBankDetails"), "Each Corporate Profile section must save to its authenticated backend section API, with a draft-save option");
assert(profile.includes("dirtySections") && profile.includes("dirtyEarlierSection") && profile.includes("index > activeStep && (index > furthestStep || dirtyEarlierSection)"), "Unsaved earlier-section changes must prevent bypassing before a save/relock response");
assert(profile.includes("profile.applicant.companyName") && profile.includes("taxIdentificationNumberMasked") && profile.includes("accountNumberMasked"), "Read-only applicant identity and masked sensitive values must come from the authenticated backend read");
assert(profile.includes("BVN linked to this account?") && !profile.includes('name="bvn"') && !profile.includes("Branch / sort code") && !profile.includes("sortCode"), "Corporate Bank Details may request a BVN-link confirmation but not a BVN number or branch/sort code");
assert(profile.includes("Section completion is not a Corporate KYC/KYB approval") && !profile.includes("localStorage") && !profile.includes("sessionStorage") && !profile.includes("console.log"), "Section completion must not imply Corporate verification/approval and browser persistence/logging is prohibited");
assert(contract.includes("accountNumberMasked") && contract.includes("taxIdentificationNumberMasked") && contract.includes("bvnLinkedToAccount: boolean | null"), "Corporate safe response contract must mask TIN/account and use only a BVN-link declaration");
assert(api.includes('authenticatedRequest("/me/corporate-profile")') && api.includes("corporateProfileVersionHeader") && api.includes("If-Match") && api.includes('"/me/corporate-profile/company-details"') && api.includes('"/me/corporate-profile/investment-profile"') && api.includes('"/me/corporate-profile/source-of-funds"') && api.includes('"/me/corporate-profile/bank-details"'), "Corporate Profile client must use owner-scoped authenticated reads and versioned section-save endpoints");

console.log("PASS — Corporate Profile uses read-only registration identity, the four requested server-backed sections, sequential completion gates, safe bank controls and versioned authenticated persistence");
