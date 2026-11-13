import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSafeReturnPath } from "../lib/auth/safe-return-path";

const root = process.cwd();
const signIn = readFileSync(resolve(root, "components/auth/SignInForm.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(getSafeReturnPath("/corporate/dashboard") === "/corporate/dashboard" && getSafeReturnPath("/corporate/profile") === "/corporate/profile", "Protected Corporate return paths must remain safe");
assert(
  signIn.includes('{ id: "corporate", label: "Business / Corporate", icon: Building2 }')
    && signIn.includes('type LoginAccountType = "individual" | "joint" | "corporate"')
    && !signIn.includes('id: "business"'),
  "The general Business option must be the Corporate applicant account type rather than an unavailable separate login",
);
assert(
  !signIn.includes("rcNumber")
    && !signIn.includes("RC Number")
    && !signIn.includes("Business login unavailable"),
  "Corporate login must use only the registered email and password; RC number must not be a login credential",
);
assert(
  signIn.includes("await login({ email, password });")
    && signIn.includes('accountType === "corporate" ? corporateDestination : safeNextPath ?? defaultDestination')
    && signIn.includes('const corporateDestination = safeNextPath?.startsWith("/corporate/") ? safeNextPath : "/corporate/dashboard";'),
  "The general Corporate choice must use the shared Investor login and route a successful applicant to the protected Corporate destination",
);
assert(
  signIn.includes('const registrationType = accountType === "corporate" ? "CORPORATE" : "INDIVIDUAL";')
    && signIn.includes('router.push(registrationType === "CORPORATE" ? "/register/corporate/verify-email" : "/register/individual/verify-email");'),
  "An unverified general Corporate login must continue through the existing Corporate verification/resend journey",
);
assert(
  signIn.includes("Account-type selection only chooses")
    && signIn.includes("it is not backend role verification")
    && signIn.includes("does not independently verify an account type or approval"),
  "Corporate tab selection must not claim backend verification, approval, or a distinct Corporate role",
);

console.log("PASS — General Business / Corporate login uses the shared INVESTOR email/password session, has no RC-number credential, preserves Corporate verification, and routes safely to Corporate protected views");
