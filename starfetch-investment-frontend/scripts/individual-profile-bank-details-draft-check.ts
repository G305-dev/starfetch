import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile, SaveIndividualKycBankDetailsInput } from "../lib/api/client";

type _IndividualAccountProfile = IndividualAccountProfile;
type _SaveIndividualKycBankDetailsInput = SaveIndividualKycBankDetailsInput;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/BankDetailsDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");
const api = read("lib/api/client.ts");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const label of ["Bank Details", "Bank name", "Account number (NUBAN)", "Account name", "Account type", "BVN linked to account"]) {
  assert(draft.includes(label), `Missing Bank Details field: ${label}`);
}
assert(!/branch|sort code/i.test(draft), "Branch and sort code must not be present in Individual Bank Details");
assert(
  draft.includes('maxLength={10}')
    && draft.includes('pattern="[0-9]{10}"')
    && draft.includes("accountNumberMasked")
    && draft.includes("The full number is not returned")
    && draft.includes("No BVN number is requested or checked"),
  "Bank Details must validate a 10-digit NUBAN, show only the returned masked account number, and avoid requesting a raw BVN",
);
assert(
  profile.includes("saveIndividualKycBankDetails({")
    && profile.includes("accountNumber: draft.accountNumber.trim()")
    && profile.includes('bvnLinkedToAccount: draft.bvnLinkedToAccount === "yes"')
    && profile.includes("accountNumber: \"\""),
  "Bank Details must save the user-entered account number and boolean linkage declaration, never hydrate the full account number from GET",
);
assert(
  api.includes('"/me/kyc-profile/bank-details"')
    && api.includes("accountNumberMasked")
    && !api.includes("accountNumber: readString(bank"),
  "The KYC read model must expose only the masked account number and the bank mutation must use the mapped route",
);

console.log("PASS — Bank Details persists through the versioned KYC endpoint, masks the saved account number, validates 10 NUBAN digits, and never requests raw BVN or branch/sort code");
