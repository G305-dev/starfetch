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
    && source.includes("localKycDraft.idCardType ?")
    && source.includes("Upload {localKycDraft.idCardType}")
    && source.includes('type="file"')
    && source.includes('accept=".pdf,image/jpeg,image/png"')
    && source.includes("idDocumentSelected")
    && source.includes('if (!localKycDraft.idDocumentSelected) return "Select an ID document file to continue.";')
    && source.includes("not uploaded, sent, or stored by the portal"),
  "Selecting an approved ID card type must reveal a current-page-only document upload form without uploading or storing the file",
);
assert(
  source.includes('value={localKycDraft.gender}')
    && source.includes("Select gender")
    && source.includes('value="male"')
    && source.includes('value="female"')
    && !source.includes('placeholder="Enter gender"'),
  "Gender must be selected from the approved Male and Female dropdown options",
);
assert(
  source.includes("type LocalKycDraft")
    && source.includes("emptyLocalKycDraft")
    && source.includes("current-page draft")
    && source.includes("not submitted, saved, verified or retained"),
  "Requested KYC fields must remain an explicitly bounded in-memory draft",
);
assert(
  source.includes('value={profile.firstName} readOnly aria-readonly="true"')
    && source.includes('value={profile.lastName} readOnly aria-readonly="true"')
    && source.includes("Your name is managed by your account and cannot be changed here.")
    && !source.includes("setProfile({ ...profile, firstName:")
    && !source.includes("setProfile({ ...profile, lastName:"),
  "Individual first and last names must be account-managed read-only fields",
);
const saveStart = source.indexOf("const savedProfile = await updateMyProfile({");
const saveEnd = source.indexOf("});", saveStart) + 3;
const saveCall = source.slice(saveStart, saveEnd);
assert(
  saveStart >= 0
    && saveCall.includes("firstName: profile.firstName.trim()")
    && saveCall.includes("lastName: profile.lastName.trim()")
    && saveCall.includes("phone: profile.phone?.trim() || null")
    && !/(dateOfBirth|gender|nationality|residentialAddress|stateOfResidence|idCardType|idDocumentSelected|occupation)/.test(saveCall),
  "Local KYC draft fields and the selected ID-document state must not be sent through the current approved profile update contract",
);
assert(
  !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|console\.(log|info|debug)/i.test(source),
  "Sensitive local KYC draft details must not be persisted or logged by the browser",
);

console.log("PASS — Individual profile keeps account-managed names read-only, provides Gender and conditional ID-document controls, and keeps local KYC data/files out of browser persistence and API submissions");
