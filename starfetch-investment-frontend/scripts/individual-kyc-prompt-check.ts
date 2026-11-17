import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  completedKycSectionCount,
  hasSubmittedIndividualKyc,
  isKycNeedsAttention,
  shouldShowIndividualKycPrompt,
  SUBMITTED_KYC_STATUSES,
} from "../lib/individual-kyc-prompt";
import type { IndividualKycProfile, IndividualKycWorkflowStatus } from "../lib/api/client";

const root = process.cwd();
const promptComponent = readFileSync(join(root, "components/portal/IndividualKycPrompt.tsx"), "utf8");
const promptRules = readFileSync(join(root, "lib/individual-kyc-prompt.ts"), "utf8");
const dashboardPage = readFileSync(join(root, "app/dashboard/page.tsx"), "utf8");
const packageJson = readFileSync(join(root, "package.json"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, label: string) {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function makeProfile(status: IndividualKycWorkflowStatus, completeSections = 0): IndividualKycProfile {
  const section = (index: number) => (index < completeSections ? "COMPLETE" : "NOT_STARTED") as "COMPLETE" | "NOT_STARTED";
  return {
    status,
    version: 0,
    sectionStatuses: {
      personal: section(0),
      investmentProfile: section(1),
      sourceOfFunds: section(2),
      bankDetails: section(3),
    },
    progression: { nextSection: "personal", canSubmit: false },
    submittedAt: status === "DRAFT" ? null : "2026-10-22T12:00:00.000Z",
    sections: {
      personal: { dateOfBirth: null, gender: null, nationality: null, residentialAddress: null, stateOfResidence: null, idDocumentType: null, occupation: null, pepStatus: null, pepDetails: null },
      investmentProfile: { primaryInvestmentObjective: null, riskTolerance: null, investmentHorizon: null, financialCurrency: null, investmentKnowledgeExperience: null, expectedWithdrawalsMinor: null, withdrawalFrequency: null, annualIncomeMinor: null, estimatedNetWorthMinor: null, investmentRestrictions: null },
      sourceOfFunds: { sourceOfFunds: [], otherSource: null, expectedAnnualInflowMinor: null, expectedTransactionFrequency: null },
      bankDetails: { bankName: null, accountNumberMasked: null, accountName: null, accountType: null, bvnLinkedToAccount: null },
    },
    documents: [],
  };
}

// Submitted states must hide the popup.
for (const status of ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "COMPLETE"] as const) {
  expectEqual(hasSubmittedIndividualKyc(makeProfile(status)), true, `hasSubmitted for ${status}`);
  expectEqual(shouldShowIndividualKycPrompt(makeProfile(status)), false, `shouldShow for ${status}`);
}

// Not-submitted states must show the popup.
for (const status of ["DRAFT", "REJECTED", "INFO_REQUIRED", "INFO_REQUESTED"] as const) {
  expectEqual(hasSubmittedIndividualKyc(makeProfile(status)), false, `hasSubmitted for ${status}`);
  expectEqual(shouldShowIndividualKycPrompt(makeProfile(status)), true, `shouldShow for ${status}`);
}

// Missing profile fails closed (show the popup).
expectEqual(hasSubmittedIndividualKyc(null), false, "hasSubmitted for null");
expectEqual(shouldShowIndividualKycPrompt(null), true, "shouldShow for null");
expectEqual(hasSubmittedIndividualKyc(undefined), false, "hasSubmitted for undefined");

// Needs-attention copy only for previously submitted states that need action.
expectEqual(isKycNeedsAttention(makeProfile("REJECTED")), true, "needs attention for REJECTED");
expectEqual(isKycNeedsAttention(makeProfile("INFO_REQUIRED")), true, "needs attention for INFO_REQUIRED");
expectEqual(isKycNeedsAttention(makeProfile("INFO_REQUESTED")), true, "needs attention for INFO_REQUESTED");
expectEqual(isKycNeedsAttention(makeProfile("DRAFT")), false, "needs attention for DRAFT");
expectEqual(isKycNeedsAttention(makeProfile("SUBMITTED")), false, "needs attention for SUBMITTED");
expectEqual(isKycNeedsAttention(null), false, "needs attention for null");

// Section progress counting.
expectEqual(completedKycSectionCount(makeProfile("DRAFT", 0)), 0, "completed sections 0");
expectEqual(completedKycSectionCount(makeProfile("DRAFT", 2)), 2, "completed sections 2");
expectEqual(completedKycSectionCount(makeProfile("DRAFT", 4)), 4, "completed sections 4");
expectEqual(completedKycSectionCount(null), 0, "completed sections null");

// Submitted status list covers the full submitted lifecycle.
assert(SUBMITTED_KYC_STATUSES.includes("SUBMITTED"), "SUBMITTED must be a submitted status");
assert(SUBMITTED_KYC_STATUSES.includes("UNDER_REVIEW"), "UNDER_REVIEW must be a submitted status");
assert(SUBMITTED_KYC_STATUSES.includes("APPROVED"), "APPROVED must be a submitted status");
assert(SUBMITTED_KYC_STATUSES.includes("COMPLETE"), "COMPLETE must be a submitted status");
assert(!SUBMITTED_KYC_STATUSES.includes("DRAFT"), "DRAFT must not be a submitted status");

// Component source checks: required popup copy, actions, and accessibility.
for (const text of ["Complete your KYC", "Complete KYC", "Maybe Later", 'href="/profile"', 'role="dialog"', 'aria-modal="true"']) {
  assert(promptComponent.includes(text), `IndividualKycPrompt is missing required markup: ${text}`);
}
assert(promptComponent.includes("getIndividualKycProfile"), "IndividualKycPrompt must load KYC status via getIndividualKycProfile");
assert(promptComponent.includes("hasSubmittedIndividualKyc"), "IndividualKycPrompt must gate visibility on hasSubmittedIndividualKyc");
assert(promptComponent.includes("setDismissed(true)"), "Maybe Later must dismiss the popup in memory");
assert(!/(localStorage|sessionStorage|document\.cookie)/.test(promptComponent), "IndividualKycPrompt must not persist dismissal in browser storage");
assert(!/(localStorage|sessionStorage|document\.cookie)/.test(promptRules), "KYC prompt rules must not use browser storage");

// Dashboard integration checks.
assert(dashboardPage.includes("<IndividualKycPrompt"), "Dashboard page must render IndividualKycPrompt");
assert(dashboardPage.includes("RequireIndividualAuth"), "Dashboard page must keep the authenticated boundary");
assert(dashboardPage.includes("<IndividualDashboardContent"), "Dashboard page must keep the dashboard content");

// Test command registration.
assert(packageJson.includes("test:individual-kyc-prompt"), "package.json must register test:individual-kyc-prompt");
assert(packageJson.includes("scripts/individual-kyc-prompt-check.ts"), "package.json must point at the KYC prompt check script");

console.log("PASS — Individual KYC prompt shows Complete KYC / Maybe Later only when KYC is not submitted, hides after submission, fails closed, and uses no browser storage");
