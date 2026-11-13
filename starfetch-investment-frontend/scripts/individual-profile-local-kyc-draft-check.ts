import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _IndividualAccountProfile = IndividualAccountProfile;

const source = readFileSync(resolve(process.cwd(), "components/portal/IndividualProfileContent.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requestedLabels = ["Date of birth", "Gender", "Nationality", "Residential address", "State of residence", "ID card type", "Occupation"];
for (const label of requestedLabels) {
  assert(source.includes(label), `Missing requested local KYC field: ${label}`);
}
assert(
  source.includes('const idCardTypes = ["", "Passport", "PVC", "Driver’s License", "NIN"]')
    && source.includes("Select ID card type")
    && source.includes("<select"),
  "ID card type must provide the approved Passport, PVC, Driver’s License, and NIN dropdown options",
);
assert(
  source.includes("type LocalKycDraft")
    && source.includes("emptyLocalKycDraft")
    && source.includes("current-page draft only")
    && source.includes("not submitted, saved, verified or retained"),
  "Requested KYC fields must remain an explicitly bounded in-memory draft",
);
const saveStart = source.indexOf("const savedProfile = await updateMyProfile({");
const saveEnd = source.indexOf("});", saveStart) + 3;
const saveCall = source.slice(saveStart, saveEnd);
assert(
  saveStart >= 0
    && saveCall.includes("firstName: profile.firstName.trim()")
    && saveCall.includes("lastName: profile.lastName.trim()")
    && saveCall.includes("phone: profile.phone?.trim() || null")
    && !/(dateOfBirth|gender|nationality|residentialAddress|stateOfResidence|idCardType|occupation)/.test(saveCall),
  "Local KYC draft fields must not be sent through the current approved profile update contract",
);
assert(
  !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|console\.(log|info|debug)/i.test(source),
  "Sensitive local KYC draft details must not be persisted or logged by the browser",
);

console.log("PASS — Individual profile includes the requested local KYC draft fields and ID-type options without persisting, logging, or transmitting unapproved sensitive data");
