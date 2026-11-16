import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CorporateApplicantInfo } from "../lib/corporate/profile";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const profile = read("components/corporate/CorporateProfileContent.tsx");
const registration = read("components/auth/CorporateApplicantRegistrationForm.tsx");
const safeApplicantShape: CorporateApplicantInfo = { companyName: "", companyPhoneNumber: "", email: "" };

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

assert(safeApplicantShape.email === "", "Read-only applicant shape must not require user-editable company fields");
assert(registration.includes('name="companyName"') && registration.includes('name="companyPhoneNumber"'), "Corporate account creation must continue to collect company name and company phone");
assert(profile.includes("Corporate applicant information") && profile.includes("applicantInfo(user)") && !/name="(?:companyName|companyPhoneNumber|email)"/.test(profile), "Applicant name, phone and email must appear as read-only account information");
assert(profile.includes('name="rcNumber"') && profile.includes('name="dateOfIncorporation"') && profile.includes('name="taxIdentificationNumber"') && profile.includes('name="registeredAddress"') && profile.includes('name="city"') && profile.includes('name="state"'), "Section 1 must include RC number, incorporation date, TIN, registered address, city and state");
const sectionTitlePositions = ["Corporate Applicant Information & Company Details", "Investment Objective & Risk Profile", "Source of Funds and Wealth", "Bank Details"].map((title) => profile.indexOf(`title: "${title}"`));
assert(sectionTitlePositions.every((position) => position >= 0) && sectionTitlePositions.every((position, index) => index === 0 || position > sectionTitlePositions[index - 1]), "The four requested Corporate Profile sections must appear in order");
assert(profile.includes("function furthestUnlockedSection") && profile.includes("completed.has(sections[index].key)") && profile.includes("index > furthest"), "Future sections must remain locked until the preceding section passes local validation");
assert(profile.includes("validateSection(activeStep") && profile.includes("setCompletedSections((current) => new Set(current).add(currentKey))"), "Section completion must be based on local validation before moving forward");
assert(profile.includes("function invalidateFrom(index: number)") && profile.includes("sections.slice(index).forEach((section) => next.delete(section.key))"), "Editing an earlier section must clear completion of that and all later sections");
assert(profile.includes("Validate & continue") && profile.includes("Mark complete for this session") && !profile.includes("Save draft") && !profile.includes("Save & continue"), "The UI must not present a server-save control or promise backend persistence");
assert(profile.includes("All four sections are complete in this page session only") && profile.includes("Nothing was sent or saved to the backend"), "Completion must remain an explicitly temporary client-side walkthrough, not backend completion");

console.log("PASS — Corporate sections progress sequentially in current-page memory, earlier edits relock later sections, and no backend save/submit is presented");
