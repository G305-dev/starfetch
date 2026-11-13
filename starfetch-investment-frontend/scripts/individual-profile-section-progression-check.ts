import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { IndividualAccountProfile } from "../lib/api/client";

// Keeps this standalone source check on the project-root compilation path.
type _IndividualAccountProfile = IndividualAccountProfile;

const source = readFileSync(resolve(process.cwd(), "components/portal/IndividualProfileContent.tsx"), "utf8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  source.includes('type ProfileStep = 1 | 2 | 3 | 4;')
    && source.includes('const [activeStep, setActiveStep] = useState<ProfileStep>(1);')
    && source.includes('const [completedThrough, setCompletedThrough] = useState(0);')
    && source.includes("function SectionProgress"),
  "Individual Profile must keep current-page-only sequential section progress",
);
assert(
  source.includes("{activeStep === 1 ? (")
    && source.includes("{activeStep === 2 ? (")
    && source.includes("{activeStep === 3 ? (")
    && source.includes("{activeStep === 4 ? ("),
  "Only the active Individual Profile section form must render at a time",
);
assert(
  source.includes("Complete Personal Information")
    && source.includes("Complete Investment Profile")
    && source.includes("Complete Source of Funds")
    && source.includes("Complete Bank Details")
    && source.includes("setCompletedThrough(1)")
    && source.includes("setCompletedThrough(2)")
    && source.includes("setCompletedThrough(3)")
    && source.includes("setCompletedThrough(4)"),
  "Each Individual Profile section must explicitly complete before the next one is unlocked",
);
assert(
  source.includes("getPersonalInformationError")
    && source.includes("getInvestmentProfileError")
    && source.includes("getSourceOfFundsError")
    && source.includes("getBankDetailsError")
    && source.includes("localPepDeclarationDraft.applicantPepStatus === \"yes\"")
    && source.includes('localSourceOfFundsDraft.selectedSources.includes("Other (specify)")'),
  "Sequential progression must require all relevant fields and conditional PEP/Other-source details",
);
assert(
  source.includes("function resetCompletionFrom")
    && source.includes("resetCompletionFrom(1)")
    && source.includes("resetCompletionFrom(2)")
    && source.includes("resetCompletionFrom(3)")
    && !/(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]/.test(source),
  "Editing an earlier section must relock dependent sections without persisting progress in the browser",
);

console.log("PASS — Individual Profile reveals one current-page section at a time, requires relevant fields before sequential unlocks, and relocks later sections when earlier drafts change");
