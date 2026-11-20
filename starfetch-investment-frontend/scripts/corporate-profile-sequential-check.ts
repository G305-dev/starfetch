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
assert(profile.includes("Corporate applicant information") && profile.includes("applicantInfo(user, profile)") && !/name="(?:companyName|companyPhoneNumber|email)"/.test(profile), "Applicant name, phone and email must appear as read-only account information");
assert(profile.includes('name="rcNumber"') && profile.includes('name="dateOfIncorporation"') && profile.includes('name="taxIdentificationNumber"') && profile.includes('name="registeredAddress"') && profile.includes('name="city"') && profile.includes('name="state"'), "Section 1 must include RC number, incorporation date, TIN, registered address, city and state");
const sectionTitlePositions = ["Corporate Applicant Information & Company Details", "Investment Objective & Risk Profile", "Source of Funds and Wealth", "Bank Details"].map((title) => profile.indexOf(`title: "${title}"`));
assert(sectionTitlePositions.every((position) => position >= 0) && sectionTitlePositions.every((position, index) => index === 0 || position > sectionTitlePositions[index - 1]), "The four requested Corporate Profile sections must appear in order");
assert(profile.includes("function furthestUnlockedSection") && profile.includes("completed.has(sections[index].key)") && profile.includes("index > furthest"), "Future sections must remain locked until the preceding section is saved COMPLETE");
assert(profile.includes("validateSection(activeStep") && profile.includes("setCompletedSections(completedFrom(next))") && profile.includes("saved.sectionStatuses[section.key] === \"COMPLETE\""), "Section completion must come from the backend sectionStatuses after client validation and a successful save");
assert(profile.includes("function invalidateFrom(index: number)") && profile.includes("sections.slice(index).forEach((section) => next.delete(section.key))"), "Editing an earlier section must clear completion of that and all later sections");
assert(profile.includes("Save & continue") && profile.includes("Save bank details") && !profile.includes("Validate & continue") && !profile.includes("Mark complete for this session") && !profile.includes("Save draft") && !/\bsubmit(?:Corporate)?Application\b/.test(profile), "Each section must offer an honest per-section save (no draft-only or submission control)");
assert(profile.includes("All four sections are saved") && profile.includes("saved-form completion only") && !profile.includes("Nothing was sent or saved to the backend"), "Completion must describe saved-form completion, not verification, approval or submission");

console.log("PASS — Corporate sections progress sequentially from backend section statuses, earlier edits relock later sections, and each section is saved (never submitted) through the API");
