import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _IndividualAccountProfile = IndividualAccountProfile;

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const draft = read("components/portal/BankDetailsDraft.tsx");
const profile = read("components/portal/IndividualProfileContent.tsx");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const label of ["Bank Details", "Bank name", "Account number (NUBAN)", "Account name", "Account type", "BVN linked to account"]) {
  assert(draft.includes(label), `Missing Bank Details draft field: ${label}`);
}
assert(!/branch|sort code/i.test(draft), "Branch / sort code must not be present in the Individual Bank Details draft");
assert(
  draft.includes("Do not enter a BVN number")
    && draft.includes("type BankDetailsDraftValue")
    && draft.includes("not submitted, stored, validated, or retained")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|fetch\(|updateMyProfile|console\.(log|info|debug)/i.test(draft),
  "Bank details must remain a bounded local draft without storing, logging, or transmitting bank/BVN data",
);
assert(
  profile.includes("BankDetailsDraft")
    && profile.includes("setLocalBankDetailsDraft")
    && !profile.includes('title: "Bank Details"'),
  "The Bank Details draft must replace the unavailable Bank Details profile card",
);

console.log("PASS — Individual Profile renders the requested local Bank Details draft without Branch/sort code and without persisting, logging, validating, or transmitting bank/BVN data");
