import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _IndividualAccountProfile = IndividualAccountProfile;

const source = readFileSync(resolve(process.cwd(), "components/portal/IndividualProfileContent.tsx"), "utf8");
const api = readFileSync(resolve(process.cwd(), "lib/api/client.ts"), "utf8");

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
    && source.includes("createIndividualKycUploadIntent")
    && source.includes("completeIndividualKycDocument")
    && source.includes("credentials: \"omit\"")
    && source.includes("the API keeps uploads disabled until operational approvals are complete"),
  "Selecting an ID type must expose the authenticated guarded upload-intent flow and keep the pending-scan limitation clear",
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
    && source.includes("remain page-only until their approved option catalogues are available")
    && source.includes("Saved KYC status")
    && source.includes("saveIndividualKycPersonal"),
  "Personal data must use the encrypted KYC API, status must be server sourced, and remaining sections stay drafts until their catalogues are approved",
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
  api.includes('authenticatedRequest("/me/kyc-profile")')
    && api.includes('authenticatedRequest("/me/kyc-profile/personal", {')
    && api.includes("attemptHeaders: csrfHeaders")
    && api.includes('authenticatedMutation("/me/kyc-profile/id-document/upload-intent", input)')
    && api.includes("/id-document/${encodeURIComponent(documentId)}/complete"),
  "KYC reads and mutations must use the authenticated same-origin API client and its CSRF-protected routes",
);
assert(
  !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|console\.(log|info|debug)/i.test(source),
  "Sensitive local KYC draft details must not be persisted or logged by the browser",
);

console.log("PASS — Individual profile saves personal KYC through the encrypted versioned API, reads server status, and uses authenticated upload intents without treating pending scans as verified");
