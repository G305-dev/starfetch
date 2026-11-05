import { getJointRegistrationEntryAction, INDIVIDUAL_REGISTRATION_HREF, JOINT_REGISTRATION_SIGN_IN_HREF } from "../lib/auth/joint-registration-entry";
import { getSafeReturnPath } from "../lib/auth/safe-return-path";

const validCases: Array<[string, string]> = [
  ["/dashboard", "/dashboard"],
  ["/joint/dashboard", "/joint/dashboard"],
  ["/joint/invitations", "/joint/invitations"],
  ["/register/joint", "/register/joint"],
  ["/joint/transactions?page=2&pageSize=10#history", "/joint/transactions?page=2&pageSize=10#history"],
];

const invalidCases = [
  "https://attacker.example/collect",
  "http://attacker.example/collect",
  "//attacker.example/collect",
  "/\\attacker.example/collect",
  "/%2F%2Fattacker.example/collect",
  "/%252F%252Fattacker.example/collect",
  "/%5Cattacker.example/collect", 
  "javascript:alert(1)",
  "data:text/html,unsafe",
  "dashboard",
  "/%E0%A4%A",
  "/login",
  "/register/individual/verify-email",
  "\u0000/joint/invitations",
];

for (const [input, expected] of validCases) {
  if (getSafeReturnPath(input) !== expected) throw new Error(`Expected valid internal return path ${input}`);
}
for (const input of invalidCases) {
  if (getSafeReturnPath(input) !== null) throw new Error(`Unsafe or malformed return path was accepted: ${JSON.stringify(input)}`);
}
if (getSafeReturnPath(null) !== null || getSafeReturnPath(undefined) !== null || getSafeReturnPath("/") !== "/") throw new Error("Return-path empty/root handling failed");

if (getJointRegistrationEntryAction("loading") !== "wait" || getJointRegistrationEntryAction("unauthenticated") !== "explain" || getJointRegistrationEntryAction("authenticated") !== "continue") {
  throw new Error("Joint registration entry decisions are incorrect");
}
const jointSignInNext = new URL(JOINT_REGISTRATION_SIGN_IN_HREF, "https://starfetch-return-path.invalid").searchParams.get("next");
if (jointSignInNext !== "/register/joint" || getSafeReturnPath(jointSignInNext) !== "/register/joint" || INDIVIDUAL_REGISTRATION_HREF !== "/register/individual") {
  throw new Error("Joint registration explanation actions do not preserve safe registration navigation");
}

console.log("PASS — safe post-login return navigation and Joint registration entry actions accept internal Joint paths and reject external, malformed, encoded, and auth-loop redirects");
