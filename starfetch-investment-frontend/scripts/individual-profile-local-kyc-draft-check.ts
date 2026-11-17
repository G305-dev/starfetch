import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile, IndividualKycDocumentType } from "../lib/api/client";

type _IndividualAccountProfile = IndividualAccountProfile;
type _IndividualKycDocumentType = IndividualKycDocumentType;

const source = readFileSync(resolve(process.cwd(), "components/portal/IndividualProfileContent.tsx"), "utf8");
const api = readFileSync(resolve(process.cwd(), "lib/api/client.ts"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const label of ["Date of birth", "Gender", "Nationality", "Residential address", "State of residence", "ID card type", "Occupation"]) {
  assert(source.includes(label), `Missing Individual KYC field: ${label}`);
}
assert(
  source.includes('const idCardTypes = ["", "Passport", "PVC", "Driver’s License", "NIN"]')
    && source.includes("idCardTypeToApi")
    && source.includes("matchingIdentityDocument")
    && source.includes("Securely upload ID")
    && source.includes("createIndividualKycUploadIntent")
    && source.includes("completeIndividualKycDocument")
    && source.includes("Upload completion is not acceptance or KYC approval"),
  "ID documents must use the authenticated upload-intent/completion flow and must not be counted as verified on upload",
);
assert(
  source.includes('value={localKycDraft.gender}')
    && source.includes("Select gender")
    && source.includes('value="male"')
    && source.includes('value="female"')
    && !source.includes('placeholder="Enter gender"'),
  "Gender must remain the requested Male/Female dropdown",
);
assert(
  source.includes('value={profile.firstName} readOnly aria-readonly="true"')
    && source.includes('value={profile.lastName} readOnly aria-readonly="true"')
    && source.includes('value={profile.email} readOnly aria-readonly="true"')
    && source.includes("Your name is managed by your account and cannot be changed here."),
  "Account-managed names and email must remain read-only",
);
const profileUpdateStart = source.indexOf("const savedAccountProfile = await updateMyProfile({");
const profileUpdateEnd = source.indexOf("});", profileUpdateStart) + 3;
const accountUpdate = source.slice(profileUpdateStart, profileUpdateEnd);
assert(
  profileUpdateStart >= 0
    && accountUpdate.includes("firstName: profile.firstName.trim()")
    && accountUpdate.includes("lastName: profile.lastName.trim()")
    && accountUpdate.includes("phone: profile.phone?.trim() || null")
    && !/(dateOfBirth|gender|nationality|residentialAddress|idDocumentType|pepStatus)/.test(accountUpdate),
  "Only the existing account-managed name fields and editable phone may use the account-profile API",
);
assert(
  source.includes("saveIndividualKycPersonal({")
    && source.includes("pepStatus:")
    && source.includes("idDocumentType:")
    && source.includes("getIndividualKycProfile")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|console\.(log|info|debug)/i.test(source),
  "Individual KYC fields must use the authenticated KYC API and must not be persisted or logged by browser storage",
);
assert(
  api.includes('"/me/kyc-profile"')
    && api.includes('"/me/kyc-profile/personal"')
    && api.includes('"/me/kyc-profile/id-document/upload-intent"')
    && source.includes('credentials: "omit"'),
  "KYC reads and mutations must be owner-scoped and signed document bytes must not include browser credentials",
);

console.log("PASS — Individual personal/KYC fields restore from the owner-scoped API; account names/email stay read-only; identity files use secure upload intents and are not treated as approved");
