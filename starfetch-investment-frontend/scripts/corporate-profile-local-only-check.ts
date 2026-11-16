import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { corporateInvestmentHorizonOptions, corporateInvestmentObjectives, corporateRiskToleranceOptions, corporateSourceOfFundsOptions } from "../lib/corporate/profile";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const profile = read("components/corporate/CorporateProfileContent.tsx");
const client = read("lib/api/client.ts");
const contract = read("lib/corporate/profile.ts");

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

assert(corporateInvestmentObjectives.join("|") === "Capital preservation|Income|Balanced|Growth", "Corporate investment objective options must match the supplied form");
assert(corporateRiskToleranceOptions.join("|") === "Conservative|Moderate|Balanced|Aggressive", "Corporate risk options must match the supplied form");
assert(corporateInvestmentHorizonOptions.join("|") === "< 1 year|1–3 years|3–5 years|5 years +", "Corporate horizons must match the supplied Corporate form image");
assert(corporateSourceOfFundsOptions.join("|") === "Business income / operating cash|Sale of assets|Loan / financing|Other (specify)", "Corporate source-of-funds options must match the supplied form image");

assert(profile.includes("Corporate applicant information") && profile.includes("Company name") && profile.includes("Company phone number") && profile.includes("Account email"), "Corporate applicant information must appear in the profile");
assert(profile.includes("applicantInfo(user)") && profile.includes("Not available in this account session"), "Read-only identity fields must use only authenticated account values and clearly show when unavailable");
assert(!/name="(?:companyName|companyPhoneNumber|email)"/.test(profile), "Account-managed identity must not have editable profile controls");
for (const field of ["rcNumber", "dateOfIncorporation", "taxIdentificationNumber", "registeredAddress", "city", "state"]) assert(profile.includes(`name="${field}"`), `Company details field ${field} is missing`);
for (const field of ["primaryObjective", "riskTolerance", "investmentHorizon", "expectedWithdrawals", "withdrawalFrequency", "restrictionsOrExclusions"]) assert(profile.includes(`name="${field}"`) || profile.includes(`name={"${field}"}`), `Investment Profile field ${field} is missing`);
for (const field of ["selectedSources", "otherSource", "expectedAnnualInflow", "expectedTransactionFrequency"]) assert(profile.includes(field), `Source of Funds field ${field} is missing`);
for (const field of ["bankName", "accountNumber", "accountName", "accountType", "bvnLinkedToAccount"]) assert(profile.includes(field), `Bank Details field ${field} is missing`);
for (const key of ["companyDetails", "investmentProfile", "sourceOfFunds", "bankDetails"]) assert(profile.includes(`key: "${key}"`), `Sequential Corporate Profile section ${key} is missing`);
assert(profile.includes("furthestUnlockedSection(completedSections)") && profile.includes("disabled={disabled}") && profile.includes("setCompletedSections((current) => new Set(current).add(currentKey))"), "Later sections must unlock only after local section validation succeeds");
assert(profile.includes("invalidateFrom(0)") && profile.includes("invalidateFrom(1)") && profile.includes("invalidateFrom(2)") && profile.includes("invalidateFrom(3)"), "Editing a section must clear its completion and dependent section completion states");
assert(profile.includes("Validate & continue") && profile.includes("Mark complete for this session") && profile.includes("not sent to or saved by the backend") && profile.includes("cleared when you leave or refresh"), "The UI must clearly describe in-memory-only operation and must not imply backend saving or submission");
assert(!/\b(?:getMyCorporateProfile|saveCorporateCompanyDetails|saveCorporateInvestmentProfile|saveCorporateSourceOfFunds|saveCorporateBankDetails)\b/.test(profile) && !/\bfetch\s*\(/.test(profile), "The Corporate Profile component must not make profile API reads or writes");
assert(!/\b(?:localStorage|sessionStorage)\s*[.[]/.test(profile), "The temporary Corporate form must not persist data in browser storage");
assert(profile.includes("BVN linked to this account?") && !profile.includes('name="bvn"') && !profile.includes("Branch / sort code") && !profile.includes("sortCode"), "Bank Details may ask for BVN-linked confirmation but not raw BVN, Branch, or sort-code fields");
assert(client.includes("getMyCorporateProfile") === false && client.includes("saveCorporateCompanyDetails") === false && client.includes("saveCorporateBankDetails") === false, "The frontend API client must not expose Corporate Profile save/read routes while this flow is local-only");
assert(contract.includes("taxIdentificationNumber: string") && contract.includes("accountNumber: string") && !contract.includes("taxIdentificationNumberMasked") && !contract.includes("accountNumberMasked"), "Corporate form types must represent in-memory form values, not backend-loaded/masked profile values");

console.log("PASS — Corporate Profile form renders without profile API calls, keeps data in page memory only, validates sections in order, and does not save or submit values");
