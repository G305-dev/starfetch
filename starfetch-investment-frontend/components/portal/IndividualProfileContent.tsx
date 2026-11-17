"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Info, LoaderCircle, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import {
  completeIndividualKycDocument,
  createIndividualKycUploadIntent,
  getIndividualKycProfile,
  getMyProfile,
  isApiError,
  saveIndividualKycBankDetails,
  saveIndividualKycInvestmentProfile,
  saveIndividualKycPersonal,
  saveIndividualKycSourceOfFunds,
  submitIndividualKycProfile,
  type IndividualAccountProfile,
  type IndividualKycDocumentType,
  type IndividualKycProfile,
  type IndividualKycSectionStatuses,
  updateMyProfile,
} from "@/lib/api/client";
import {
  investmentHorizonToWire,
  investmentKnowledgeToWire,
  investmentObjectiveToWire,
  labelToWire,
  minorUnitsToNaira,
  nairaToMinorUnits,
  riskToleranceToWire,
  sourceLabelsToWire,
  sourceWireToLabels,
  wireToLabel,
} from "@/lib/individual-kyc-mapping";
import { useAuth } from "@/components/auth/AuthProvider";
import { BankDetailsDraft, emptyBankDetailsDraft } from "./BankDetailsDraft";
import { InvestmentObjectiveRiskProfileDraft, emptyInvestmentObjectiveRiskDraft } from "./InvestmentObjectiveRiskProfileDraft";
import { emptyPepDeclarationDraft, PepDeclarationDraft, type PepDeclarationDraftValue } from "./PepDeclarationDraft";
import { SourceOfFundsDraft, emptySourceOfFundsDraft } from "./SourceOfFundsDraft";

type ProfileRequestState = "loading" | "success" | "error";
type ProfileStep = 1 | 2 | 3 | 4;
type KycLoadState = "loading" | "ready" | "error";
type IndividualKycSectionKey = keyof IndividualKycSectionStatuses;

type LocalKycDraft = {
  dateOfBirth: string;
  gender: string;
  nationality: string;
  residentialAddress: string;
  stateOfResidence: string;
  idCardType: string;
  occupation: string;
};

const idCardTypes = ["", "Passport", "PVC", "Driver’s License", "NIN"];
const apiIdCardTypeToLabel: Record<IndividualKycDocumentType, string> = {
  PASSPORT: "Passport",
  PVC: "PVC",
  DRIVERS_LICENSE: "Driver’s License",
  NIN: "NIN",
};
const idCardTypeToApi: Record<string, IndividualKycDocumentType> = {
  Passport: "PASSPORT",
  PVC: "PVC",
  "Driver’s License": "DRIVERS_LICENSE",
  NIN: "NIN",
};
const profileSteps: Array<{ step: ProfileStep; key: IndividualKycSectionKey; title: string; description: string }> = [
  { step: 1, key: "personal", title: "Personal information", description: "Contact details, KYC details and PEP declaration" },
  { step: 2, key: "investmentProfile", title: "Investment profile", description: "Objectives, horizon and risk preferences" },
  { step: 3, key: "sourceOfFunds", title: "Source of funds", description: "Funds and wealth details" },
  { step: 4, key: "bankDetails", title: "Bank details", description: "Settlement account details" },
];

function emptyLocalKycDraft(): LocalKycDraft {
  return { dateOfBirth: "", gender: "", nationality: "", residentialAddress: "", stateOfResidence: "", idCardType: "", occupation: "" };
}

function acceptedDocumentContentType(file: File): "application/pdf" | "image/jpeg" | "image/png" | null {
  const byExtension: Record<string, "application/pdf" | "image/jpeg" | "image/png"> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expected = byExtension[extension];
  if (!expected || (file.type && file.type !== expected)) return null;
  return expected;
}

async function sha256Base64(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

function individualKycErrorMessage(error: unknown): string {
  if (!isApiError(error)) return "We couldn’t complete that action. Check your connection and try again.";
  switch (error.code) {
    case "UNAUTHENTICATED": return "Your session has ended. Sign in again to continue.";
    case "VALIDATION_FAILED": return "Please review the information in this section and try again.";
    case "CONFLICT": return "Your saved profile changed in another session. We’ll reload the latest progress.";
    case "FORBIDDEN": return "You don’t have access to this Individual KYC profile.";
    case "NOT_FOUND": return "This profile service is unavailable right now. Please try again later.";
    case "NETWORK_ERROR": return "We couldn’t reach the server. Check your connection and try again.";
    case "RATE_LIMITED": return "Too many requests were made. Wait a moment, then try again.";
    default: return "We couldn’t save your information right now. Please try again.";
  }
}

function statusForStep(profile: IndividualKycProfile, step: ProfileStep) {
  return profile.sectionStatuses[profileSteps[step - 1].key];
}

function completedThrough(profile: IndividualKycProfile | null): number {
  if (!profile) return 0;
  let count = 0;
  for (const section of profileSteps) {
    if (profile.sectionStatuses[section.key] !== "COMPLETE") break;
    count += 1;
  }
  return count;
}

function stepFromApiName(value: string | null): ProfileStep | null {
  if (!value) return null;
  const key = value.replace(/[^a-z]/gi, "").toLowerCase();
  if (key === "personal" || key === "personalinformation") return 1;
  if (key === "investment" || key === "investmentprofile") return 2;
  if (key === "sourceoffunds" || key === "sourceoffundsandwealth") return 3;
  if (key === "bank" || key === "bankdetails") return 4;
  return null;
}

function nextProfileStep(profile: IndividualKycProfile): ProfileStep {
  if (profile.progression.canSubmit) return 4;
  const apiStep = stepFromApiName(profile.progression.nextSection);
  if (apiStep) return apiStep;
  const next = profileSteps.find(({ key }) => profile.sectionStatuses[key] !== "COMPLETE");
  return next?.step ?? 4;
}

function matchingIdentityDocument(profile: IndividualKycProfile | null, typeLabel: string) {
  if (!profile) return null;
  const documentType = idCardTypeToApi[typeLabel];
  if (!documentType) return null;
  return profile.documents.find((document) => document.documentType === documentType
    && !["REJECTED", "REMOVED", "REPLACED"].includes(document.status ?? "")
    && document.manualReviewStatus !== "REJECTED") ?? null;
}

function formattedStatus(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "Not available";
}

function documentReviewLabel(document: NonNullable<ReturnType<typeof matchingIdentityDocument>>) {
  if (document.status?.toUpperCase() === "UNDER_REVIEW" || document.manualReviewStatus?.toUpperCase() === "UNDER_REVIEW") return "UNDER_REVIEW";
  return document.manualReviewStatus ?? document.status ?? "RECEIVED";
}

function formattedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

function inputClassName(readOnly = false) {
  return `min-h-11 w-full rounded-md border border-star-200 px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${readOnly ? "cursor-not-allowed bg-star-50 text-star-muted" : "bg-white"}`;
}

function SectionProgress({ profile, loadState, activeStep, dirtySteps, onSelect }: { profile: IndividualKycProfile | null; loadState: KycLoadState; activeStep: ProfileStep; dirtySteps: ProfileStep[]; onSelect: (step: ProfileStep) => void }) {
  const completeCount = completedThrough(profile);
  const completionPercent = Math.round((completeCount / profileSteps.length) * 100);
  const nextStep = profile ? nextProfileStep(profile) : 1;
  const maxAvailableStep = profile ? (profile.progression.canSubmit ? profileSteps.length : nextStep) : 0;

  return (
    <aside className="rounded-2xl border border-star-200 bg-white p-5 shadow-[0_4px_18px_rgba(0,59,42,0.05)] sm:p-6" aria-labelledby="profile-progress-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-star-700">Your profile</p>
          <h2 id="profile-progress-heading" className="mt-1 text-lg font-extrabold text-star-900">Profile progress</h2>
        </div>
        {profile ? <span className="rounded-full bg-star-50 px-3 py-1 text-xs font-extrabold text-star-700">{formattedStatus(profile.status)}</span> : <span className="rounded-full bg-star-50 px-3 py-1 text-xs font-extrabold text-star-700">{loadState === "loading" ? "Loading" : "Unavailable"}</span>}
      </div>

      <div className="mt-5 flex items-center gap-4 rounded-xl bg-[#f5f9f1] p-4">
        <div role="progressbar" aria-label="KYC sections saved complete" aria-valuemin={0} aria-valuemax={profileSteps.length} aria-valuenow={completeCount} aria-valuetext={`${completeCount} of ${profileSteps.length} sections saved complete`} style={{ background: `conic-gradient(#76b900 ${completionPercent * 3.6}deg, #e4ebe3 0deg)` }} className="grid size-[76px] shrink-0 place-items-center rounded-full p-[7px]">
          <span className="grid size-full place-items-center rounded-full bg-white text-center"><span className="text-lg font-extrabold leading-none text-star-900">{completionPercent}%</span></span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-star-900">{loadState === "loading" ? "Loading saved progress…" : profile ? (profile.progression.canSubmit ? "Ready to submit" : `Next: ${profileSteps[nextStep - 1].title}`) : "Saved progress unavailable"}</p>
          <p className="mt-1 text-xs leading-5 text-star-muted">{profile ? "Progress is restored from your Individual KYC profile." : "Retry loading to view your saved sections."}</p>
        </div>
      </div>

      <ol className="mt-5 grid gap-2">
        {profileSteps.map(({ step, key, title, description }) => {
          const state = profile?.sectionStatuses[key] ?? "NOT_STARTED";
          const isDirty = dirtySteps.includes(step);
          const isComplete = state === "COMPLETE" && !isDirty;
          const isAvailable = step <= maxAvailableStep || Boolean(profile?.progression.canSubmit);
          const isActive = step === activeStep;
          const stateLabel = isDirty ? "Unsaved changes" : isComplete ? (isActive ? "Current" : "Saved · edit") : state === "DRAFT" ? (isActive ? "In progress" : "Saved draft") : isActive ? "Next" : "Locked";

          return (
            <li key={step}>
              {isAvailable && loadState === "ready" ? (
                <button type="button" onClick={() => onSelect(step)} aria-current={isActive ? "step" : undefined} aria-label={`${title}: ${stateLabel}. ${description}`} className={`flex min-h-[76px] w-full items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-1 ${isActive ? "border-star-700 bg-star-50" : "border-star-200 bg-white hover:border-star-300 hover:bg-star-50"}`}>
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-xs font-extrabold ${isComplete ? "bg-star-700 text-star-lime" : "bg-star-100 text-star-700"}`}>{isComplete ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : step}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-star-900">{title}</span><span className="mt-0.5 block text-xs leading-5 text-star-muted">{description}</span></span>
                  <span className="shrink-0 pt-1 text-[0.63rem] font-extrabold uppercase tracking-[0.07em] text-star-700">{stateLabel}</span>
                </button>
              ) : (
                <div className="flex min-h-[76px] items-start gap-3 rounded-xl border border-star-100 bg-star-50/70 p-3 text-star-muted" aria-label={`${title}: ${loadState === "loading" ? "saved status is loading" : "locked until the previous section is saved complete"}`}>
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white text-star-muted"><LockKeyhole size={14} aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold">{title}</span><span className="mt-0.5 block text-xs leading-5">{loadState === "loading" ? "Loading saved status…" : description}</span></span>
                  <span className="shrink-0 pt-1 text-[0.63rem] font-extrabold uppercase tracking-[0.07em]">Locked</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex gap-2 border-t border-star-100 pt-4"><Info size={17} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><p className="text-xs leading-5 text-star-muted">Saved section completion is not identity verification or account approval.</p></div>
    </aside>
  );
}

export function IndividualProfileContent() {
  const { status: authStatus, invalidateSession } = useAuth();
  const [requestState, setRequestState] = useState<ProfileRequestState>("loading");
  const [profile, setProfile] = useState<IndividualAccountProfile | null>(null);
  const [kycProfile, setKycProfile] = useState<IndividualKycProfile | null>(null);
  const [kycLoadState, setKycLoadState] = useState<KycLoadState>("loading");
  const [kycLoadMessage, setKycLoadMessage] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploadState, setDocumentUploadState] = useState<"idle" | "uploading">("idle");
  const [documentUploadMessage, setDocumentUploadMessage] = useState("");
  const [localKycDraft, setLocalKycDraft] = useState<LocalKycDraft>(emptyLocalKycDraft);
  const [localInvestmentRiskDraft, setLocalInvestmentRiskDraft] = useState(emptyInvestmentObjectiveRiskDraft);
  const [localBankDetailsDraft, setLocalBankDetailsDraft] = useState(emptyBankDetailsDraft);
  const [localPepDeclarationDraft, setLocalPepDeclarationDraft] = useState<PepDeclarationDraftValue>(emptyPepDeclarationDraft);
  const [localSourceOfFundsDraft, setLocalSourceOfFundsDraft] = useState(emptySourceOfFundsDraft);
  const [activeStep, setActiveStep] = useState<ProfileStep>(1);
  const [dirtySteps, setDirtySteps] = useState<ProfileStep[]>([]);
  const [stepError, setStepError] = useState("");
  const [stepNotice, setStepNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const accountRequestVersion = useRef(0);
  const kycRequestVersion = useRef(0);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const matchingDocument = matchingIdentityDocument(kycProfile, localKycDraft.idCardType);

  const loadProfile = useCallback(async () => {
    const version = accountRequestVersion.current + 1;
    accountRequestVersion.current = version;
    setRequestState("loading");
    setNotice("");
    try {
      const nextProfile = await getMyProfile();
      if (version !== accountRequestVersion.current) return;
      setProfile(nextProfile);
      setRequestState("success");
    } catch (error) {
      if (version !== accountRequestVersion.current) return;
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setProfile(null);
      setRequestState("error");
    }
  }, [invalidateSession]);

  const loadKycProfile = useCallback(async (hydrateDraft = true): Promise<IndividualKycProfile | null> => {
    const requestId = kycRequestVersion.current + 1;
    kycRequestVersion.current = requestId;
    setKycLoadState("loading");
    setKycLoadMessage("");
    try {
      const saved = await getIndividualKycProfile();
      if (requestId !== kycRequestVersion.current) return null;
      setKycProfile(saved);
      if (hydrateDraft) {
        const personal = saved.sections.personal;
        const pep = personal.pepDetails;
        const pepFields = typeof pep === "string" ? { fullName: pep, position: "", country: "", periodHeld: "" } : pep ?? { fullName: "", position: "", country: "", periodHeld: "" };
        setLocalKycDraft({
          dateOfBirth: personal.dateOfBirth ?? "",
          gender: personal.gender?.toLowerCase() ?? "",
          nationality: personal.nationality ?? "",
          residentialAddress: personal.residentialAddress ?? "",
          stateOfResidence: personal.stateOfResidence ?? "",
          idCardType: personal.idDocumentType ? apiIdCardTypeToLabel[personal.idDocumentType] : "",
          occupation: personal.occupation ?? "",
        });
        setLocalPepDeclarationDraft({
          applicantPepStatus: personal.pepStatus?.toLowerCase() ?? "",
          fullName: pepFields.fullName,
          position: pepFields.position,
          country: pepFields.country,
          periodHeld: pepFields.periodHeld,
        });
        const investment = saved.sections.investmentProfile;
        setLocalInvestmentRiskDraft({
          primaryObjective: wireToLabel(investmentObjectiveToWire, investment.primaryInvestmentObjective),
          riskTolerance: wireToLabel(riskToleranceToWire, investment.riskTolerance),
          investmentHorizon: wireToLabel(investmentHorizonToWire, investment.investmentHorizon),
          knowledgeAndExperience: wireToLabel(investmentKnowledgeToWire, investment.investmentKnowledgeExperience),
          expectedWithdrawals: minorUnitsToNaira(investment.expectedWithdrawalsMinor),
          withdrawalFrequency: investment.withdrawalFrequency ?? "",
          annualIncome: minorUnitsToNaira(investment.annualIncomeMinor),
          estimatedNetWorth: minorUnitsToNaira(investment.estimatedNetWorthMinor),
          restrictionsOrExclusions: investment.investmentRestrictions ?? "",
        });
        const source = saved.sections.sourceOfFunds;
        setLocalSourceOfFundsDraft({
          selectedSources: sourceWireToLabels(source.sourceOfFunds),
          otherSource: source.otherSource ?? "",
          expectedAnnualInflow: minorUnitsToNaira(source.expectedAnnualInflowMinor),
          expectedTransactionFrequency: source.expectedTransactionFrequency ?? "",
        });
        const bank = saved.sections.bankDetails;
        setLocalBankDetailsDraft({
          bankName: bank.bankName ?? "",
          accountNumber: "",
          accountName: bank.accountName ?? "",
          accountType: bank.accountType ?? "",
          bvnLinkedToAccount: bank.bvnLinkedToAccount === null ? "" : bank.bvnLinkedToAccount ? "yes" : "no",
        });
        setDirtySteps([]);
      }
      setActiveStep(nextProfileStep(saved));
      setKycLoadState("ready");
      return saved;
    } catch (error) {
      if (requestId !== kycRequestVersion.current) return null;
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setKycLoadMessage(individualKycErrorMessage(error));
      setKycLoadState("error");
      return null;
    }
  }, [invalidateSession]);

  function markSectionDirty(step: ProfileStep) {
    setDirtySteps((current) => current.includes(step) ? current : [...current, step]);
    setStepError("");
    setStepNotice("");
    setNotice("");
  }

  function selectStep(step: ProfileStep) {
    if (!kycProfile || kycLoadState !== "ready") return;
    const maxStep = kycProfile.progression.canSubmit ? profileSteps.length : nextProfileStep(kycProfile);
    if (step > maxStep && !kycProfile.progression.canSubmit) return;
    setActiveStep(step);
    setStepError("");
    setStepNotice("");
  }

  function getPersonalInformationError() {
    if (!profile?.phone?.trim()) return "Enter your phone number to save Personal Information.";
    const requiredFields: Array<[string, string]> = [
      ["date of birth", localKycDraft.dateOfBirth],
      ["gender", localKycDraft.gender],
      ["nationality", localKycDraft.nationality],
      ["residential address", localKycDraft.residentialAddress],
      ["state of residence", localKycDraft.stateOfResidence],
      ["ID card type", localKycDraft.idCardType],
      ["occupation", localKycDraft.occupation],
    ];
    const missing = requiredFields.find(([, value]) => !value.trim());
    if (missing) return `Complete your ${missing[0]} to continue.`;
    if (!/^[A-Za-z]{2}$/.test(localKycDraft.nationality.trim())) return "Enter nationality as a two-letter country code, for example NG.";
    if (!localPepDeclarationDraft.applicantPepStatus) return "Select Yes or No in the PEP Declaration to continue.";
    if (localPepDeclarationDraft.applicantPepStatus === "yes") {
      const pepFields = [localPepDeclarationDraft.fullName, localPepDeclarationDraft.position, localPepDeclarationDraft.country, localPepDeclarationDraft.periodHeld];
      if (pepFields.some((value) => !value.trim())) return "Complete the name, position, country and period held for the PEP declaration.";
    }
    if (!kycProfile || !matchingIdentityDocument(kycProfile, localKycDraft.idCardType)) return "Securely upload an identity document that matches the selected ID card type before continuing.";
    return "";
  }

  function getInvestmentProfileError() {
    const fields: Array<[string, string]> = [
      ["primary investment objective", localInvestmentRiskDraft.primaryObjective],
      ["risk tolerance", localInvestmentRiskDraft.riskTolerance],
      ["investment horizon", localInvestmentRiskDraft.investmentHorizon],
      ["investment knowledge and experience", localInvestmentRiskDraft.knowledgeAndExperience],
      ["expected withdrawals", localInvestmentRiskDraft.expectedWithdrawals],
      ["withdrawal frequency", localInvestmentRiskDraft.withdrawalFrequency],
      ["annual income", localInvestmentRiskDraft.annualIncome],
      ["estimated net worth", localInvestmentRiskDraft.estimatedNetWorth],
    ];
    const missing = fields.find(([, value]) => !value.trim());
    if (missing) return `Complete your ${missing[0]} to continue.`;
    if (!labelToWire(investmentObjectiveToWire, localInvestmentRiskDraft.primaryObjective)
      || !labelToWire(riskToleranceToWire, localInvestmentRiskDraft.riskTolerance)
      || !labelToWire(investmentHorizonToWire, localInvestmentRiskDraft.investmentHorizon)
      || !labelToWire(investmentKnowledgeToWire, localInvestmentRiskDraft.knowledgeAndExperience)) return "Select a supported option in each investment profile field.";
    if (nairaToMinorUnits(localInvestmentRiskDraft.expectedWithdrawals) === null
      || nairaToMinorUnits(localInvestmentRiskDraft.annualIncome) === null
      || nairaToMinorUnits(localInvestmentRiskDraft.estimatedNetWorth) === null) return "Enter each amount in naira using digits and up to two decimal places.";
    return "";
  }

  function getSourceOfFundsError() {
    if (!localSourceOfFundsDraft.selectedSources.length) return "Select at least one source of funds to continue.";
    const sources = sourceLabelsToWire(localSourceOfFundsDraft.selectedSources);
    if (!sources) return "Select only the listed source-of-funds options.";
    if (sources.includes("OTHER") && !localSourceOfFundsDraft.otherSource.trim()) return "Specify the other source of funds to continue.";
    if (nairaToMinorUnits(localSourceOfFundsDraft.expectedAnnualInflow) === null) return "Enter the expected annual inflow in naira using digits and up to two decimal places.";
    if (!localSourceOfFundsDraft.expectedTransactionFrequency.trim()) return "Enter the expected transaction frequency to continue.";
    return "";
  }

  function getBankDetailsError() {
    const required: Array<[string, string]> = [
      ["bank name", localBankDetailsDraft.bankName],
      ["account number", localBankDetailsDraft.accountNumber],
      ["account name", localBankDetailsDraft.accountName],
      ["account type", localBankDetailsDraft.accountType],
      ["BVN-linked account confirmation", localBankDetailsDraft.bvnLinkedToAccount],
    ];
    const missing = required.find(([, value]) => !value.trim());
    if (missing) return `Complete your ${missing[0]} to continue.`;
    if (!/^\d{10}$/.test(localBankDetailsDraft.accountNumber)) return "Enter the 10-digit NUBAN account number.";
    if (localBankDetailsDraft.bvnLinkedToAccount !== "yes" && localBankDetailsDraft.bvnLinkedToAccount !== "no") return "Select Yes or No for BVN-linked account confirmation.";
    return "";
  }

  async function handleKycError(error: unknown) {
    if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
    if (isApiError(error) && error.code === "CONFLICT") {
      await loadKycProfile(true);
      return "Your saved profile changed elsewhere. We reloaded the latest progress; review it and try again.";
    }
    return individualKycErrorMessage(error);
  }

  async function finishSavedSection(step: ProfileStep) {
    setDirtySteps((current) => current.filter((value) => value !== step));
    const refreshed = await loadKycProfile(true);
    if (!refreshed) {
      setStepNotice("Your section was saved, but we couldn’t refresh its current status. Retry loading saved progress before continuing.");
      return;
    }
    if (statusForStep(refreshed, step) !== "COMPLETE") {
      setStepNotice(`${profileSteps[step - 1].title} was saved as a draft. Complete any remaining requirements before continuing.`);
      return;
    }
    if (step < 4) setStepNotice(`${profileSteps[step - 1].title} saved. Continue with ${profileSteps[step].title}.`);
    else if (refreshed.progression.canSubmit) setStepNotice("All four sections are saved. Your application is ready to submit for review.");
    else setStepNotice("Bank Details are saved. The server will enable submission when all required checks are complete.");
  }

  async function savePersonalInformation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !kycProfile || saving || kycLoadState !== "ready") return;
    const validationError = getPersonalInformationError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }

    setSaving(true);
    setNotice("");
    setStepError("");
    let phoneSaved = false;
    try {
      const savedAccountProfile = await updateMyProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim() || null,
      });
      phoneSaved = true;
      setProfile(savedAccountProfile);
      const personal = localKycDraft;
      const pep = localPepDeclarationDraft;
      const result = await saveIndividualKycPersonal({
        version: kycProfile.version,
        dateOfBirth: personal.dateOfBirth,
        gender: personal.gender.toUpperCase() as "MALE" | "FEMALE",
        nationality: personal.nationality.trim().toUpperCase(),
        residentialAddress: personal.residentialAddress.trim(),
        stateOfResidence: personal.stateOfResidence.trim(),
        idDocumentType: idCardTypeToApi[personal.idCardType],
        occupation: personal.occupation.trim(),
        pepStatus: pep.applicantPepStatus.toUpperCase() as "YES" | "NO",
        pepDetails: pep.applicantPepStatus === "yes" ? {
          fullName: pep.fullName.trim(),
          position: pep.position.trim(),
          country: pep.country.trim(),
          periodHeld: pep.periodHeld.trim(),
        } : null,
      });
      setKycProfile((current) => current ? { ...current, version: result.version } : current);
      setNotice("Phone number and Personal KYC details saved to your account.");
      await finishSavedSection(1);
    } catch (error) {
      const message = await handleKycError(error);
      setStepError(phoneSaved ? `Your phone number was saved, but Personal KYC could not be saved. ${message}` : message);
    } finally {
      setSaving(false);
    }
  }

  async function saveMappedSection(step: ProfileStep, saver: (version: number) => Promise<{ version: number }>) {
    if (!kycProfile || saving || kycLoadState !== "ready") return;
    setSaving(true);
    setStepError("");
    setStepNotice("");
    setNotice("");
    try {
      const result = await saver(kycProfile.version);
      setKycProfile((current) => current ? { ...current, version: result.version } : current);
      await finishSavedSection(step);
    } catch (error) {
      setStepError(await handleKycError(error));
    } finally {
      setSaving(false);
    }
  }

  async function saveInvestmentProfile() {
    const validationError = getInvestmentProfileError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }
    const draft = localInvestmentRiskDraft;
    const objective = labelToWire(investmentObjectiveToWire, draft.primaryObjective);
    const risk = labelToWire(riskToleranceToWire, draft.riskTolerance);
    const horizon = labelToWire(investmentHorizonToWire, draft.investmentHorizon);
    const knowledge = labelToWire(investmentKnowledgeToWire, draft.knowledgeAndExperience);
    const expectedWithdrawalsMinor = nairaToMinorUnits(draft.expectedWithdrawals);
    const annualIncomeMinor = nairaToMinorUnits(draft.annualIncome);
    const estimatedNetWorthMinor = nairaToMinorUnits(draft.estimatedNetWorth);
    if (!objective || !risk || !horizon || !knowledge || !expectedWithdrawalsMinor || !annualIncomeMinor || !estimatedNetWorthMinor) return;
    await saveMappedSection(2, (version) => saveIndividualKycInvestmentProfile({
      version,
      primaryInvestmentObjective: objective,
      riskTolerance: risk,
      investmentHorizon: horizon,
      financialCurrency: "NGN",
      investmentKnowledgeExperience: knowledge,
      expectedWithdrawalsMinor,
      withdrawalFrequency: draft.withdrawalFrequency.trim(),
      annualIncomeMinor,
      estimatedNetWorthMinor,
      investmentRestrictions: draft.restrictionsOrExclusions.trim() || null,
    }));
  }

  async function saveSourceOfFunds() {
    const validationError = getSourceOfFundsError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }
    const draft = localSourceOfFundsDraft;
    const sourceOfFunds = sourceLabelsToWire(draft.selectedSources);
    const expectedAnnualInflowMinor = nairaToMinorUnits(draft.expectedAnnualInflow);
    if (!sourceOfFunds || !expectedAnnualInflowMinor) return;
    await saveMappedSection(3, (version) => saveIndividualKycSourceOfFunds({
      version,
      sourceOfFunds,
      ...(sourceOfFunds.includes("OTHER") ? { otherSource: draft.otherSource.trim() } : {}),
      expectedAnnualInflowMinor,
      expectedTransactionFrequency: draft.expectedTransactionFrequency.trim(),
    }));
  }

  async function saveBankDetails() {
    const validationError = getBankDetailsError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }
    const draft = localBankDetailsDraft;
    await saveMappedSection(4, (version) => saveIndividualKycBankDetails({
      version,
      bankName: draft.bankName.trim(),
      accountNumber: draft.accountNumber.trim(),
      accountName: draft.accountName.trim(),
      accountType: draft.accountType.trim(),
      bvnLinkedToAccount: draft.bvnLinkedToAccount === "yes",
    }));
  }

  async function uploadSelectedIdDocument() {
    if (!documentFile || !kycProfile || documentUploadState === "uploading" || kycLoadState !== "ready") return;
    const contentType = acceptedDocumentContentType(documentFile);
    if (!contentType) {
      setDocumentUploadMessage("Choose a PDF, JPEG or PNG file whose extension matches its file type.");
      return;
    }
    if (documentFile.size < 1 || documentFile.size > 10 * 1024 * 1024) {
      setDocumentUploadMessage("The document must be between 1 byte and 10 MiB.");
      return;
    }
    const documentType = idCardTypeToApi[localKycDraft.idCardType];
    if (!documentType) {
      setDocumentUploadMessage("Select a supported identity document type first.");
      return;
    }
    setDocumentUploadState("uploading");
    setDocumentUploadMessage("Preparing a secure upload…");
    let bytesTransferred = false;
    try {
      const checksumSha256 = await sha256Base64(documentFile);
      const intent = await createIndividualKycUploadIntent({
        version: kycProfile.version,
        documentType,
        originalFilename: documentFile.name,
        contentType,
        sizeBytes: documentFile.size,
        checksumSha256,
      });
      setKycProfile((current) => current ? { ...current, version: intent.version } : current);
      const put = await fetch(intent.uploadUrl, {
        method: "PUT",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: intent.requiredHeaders,
        body: documentFile,
      });
      if (!put.ok) throw new Error("SIGNED_UPLOAD_FAILED");
      bytesTransferred = true;
      const completed = await completeIndividualKycDocument(intent.documentId, intent.version);
      setKycProfile((current) => current ? { ...current, version: completed.version } : current);
      setDocumentFile(null);
      if (documentInputRef.current) documentInputRef.current.value = "";
      setDocumentUploadMessage("Your document was uploaded and is awaiting manual review. Upload completion is not acceptance or KYC approval.");
      await loadKycProfile(false);
    } catch (error) {
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      if (isApiError(error) && error.code === "CONFLICT") {
        await loadKycProfile(false);
        setDocumentUploadMessage("Your saved profile changed elsewhere. We reloaded its latest progress; please check document status before retrying.");
      } else if (bytesTransferred) {
        setDocumentUploadMessage("The file may have reached secure storage, but the upload could not be confirmed. Check its saved status before retrying.");
      } else if (error instanceof Error && error.message === "SIGNED_UPLOAD_FAILED") {
        setDocumentUploadMessage("The secure upload did not finish. Please try again.");
      } else {
        setDocumentUploadMessage(individualKycErrorMessage(error));
      }
    } finally {
      setDocumentUploadState("idle");
    }
  }

  async function submitApplication() {
    if (!kycProfile || !kycProfile.progression.canSubmit || submitting || kycLoadState !== "ready") return;
    setSubmitting(true);
    setStepError("");
    setStepNotice("");
    try {
      const result = await submitIndividualKycProfile(kycProfile.version);
      setDirtySteps([]);
      setKycProfile((current) => current ? { ...current, status: result.status, version: result.version, submittedAt: result.submittedAt } : current);
      await loadKycProfile(false);
    } catch (error) {
      setStepError(await handleKycError(error));
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated") {
      void loadProfile();
      void loadKycProfile(true);
    } else {
      accountRequestVersion.current += 1;
      kycRequestVersion.current += 1;
      setProfile(null);
      setKycProfile(null);
      setKycLoadState("loading");
      setKycLoadMessage("");
      setDocumentFile(null);
      setDocumentUploadMessage("");
      setLocalKycDraft(emptyLocalKycDraft());
      setLocalInvestmentRiskDraft(emptyInvestmentObjectiveRiskDraft());
      setLocalBankDetailsDraft(emptyBankDetailsDraft());
      setLocalPepDeclarationDraft(emptyPepDeclarationDraft());
      setLocalSourceOfFundsDraft(emptySourceOfFundsDraft());
      setActiveStep(1);
      setDirtySteps([]);
      setStepError("");
      setStepNotice("");
      setNotice("");
    }

    return () => {
      accountRequestVersion.current += 1;
      kycRequestVersion.current += 1;
    };
  }, [authStatus, loadKycProfile, loadProfile]);

  return (
    <section className="mx-auto max-w-[1260px]" aria-labelledby="individual-profile-heading">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-extrabold text-star-700 no-underline transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
        <ArrowLeft size={17} aria-hidden="true" />
        Return to Dashboard
      </Link>

      <div className="mt-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Individual account</p>
        <h1 id="individual-profile-heading" className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted">Complete each current-page section in sequence. Your saved sections are restored when you return to this profile.</p>
      </div>

      {requestState === "loading" ? (
        <section className="mt-7 rounded-xl border border-star-200 bg-white p-6" aria-busy="true">
          <div className="flex items-center gap-3 text-sm font-semibold text-star-muted"><LoaderCircle size={20} className="animate-spin text-star-700" aria-hidden="true" />Loading your profile…</div>
        </section>
      ) : null}

      {requestState === "error" ? (
        <section className="mt-7 rounded-xl border border-star-200 bg-star-50 p-6" role="alert">
          <h2 className="text-lg font-extrabold text-star-900">We couldn’t load your profile.</h2>
          <p className="mt-2 text-sm text-star-muted">Please try again.</p>
          <button type="button" onClick={() => void loadProfile()} className="mt-5 min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Retry</button>
        </section>
      ) : null}

      {requestState === "success" && profile ? (
        <>
          <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-star-200 bg-white p-5 shadow-[0_4px_18px_rgba(0,59,42,0.05)] sm:flex-row sm:items-center sm:p-6" aria-label="Individual account profile overview">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-star-100 text-lg font-extrabold tracking-wide text-star-700 ring-4 ring-[#f5f9f1]">{`${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase() || "IN"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.16em] text-star-700">Individual investor</p>
              <h2 className="mt-1 truncate font-display text-xl font-extrabold tracking-[-0.03em] text-star-900">{`${profile.firstName} ${profile.lastName}`.trim() || "Investor profile"}</h2>
              <p className="mt-1 text-sm leading-5 text-star-muted">Your account-managed identity and saved profile sections.</p>
            </div>
            <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-star-200 bg-[#f8faf5] px-4 text-xs font-bold text-star-700">Individual account</span>
          </section>

          {kycProfile && (kycProfile.status === "SUBMITTED" || kycProfile.status === "UNDER_REVIEW") ? (
            <section className="mt-6 overflow-hidden rounded-2xl border border-[#cce7d0] bg-white shadow-[0_4px_18px_rgba(0,59,42,0.05)]" aria-labelledby="account-under-review-heading">
              <div className="bg-[#f1f8ed] p-6 sm:p-8">
                <span className="grid size-12 place-items-center rounded-full bg-star-700 text-star-lime"><Check size={25} strokeWidth={3} aria-hidden="true" /></span>
                <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Application received</p>
                <h2 id="account-under-review-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.04em] text-star-900">Account Under Review</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-star-muted">Your application has been submitted and is awaiting review. Submission and document upload do not mean your identity has been verified or your account has been approved.</p>
                {formattedDate(kycProfile.submittedAt) ? <p className="mt-4 text-xs font-semibold text-star-muted">Submitted {formattedDate(kycProfile.submittedAt)}</p> : null}
                <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-star-700 px-5 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Return to Dashboard</Link>
              </div>
            </section>
          ) : kycProfile && kycProfile.status !== "DRAFT" ? (
            <section className="mt-6 rounded-2xl border border-star-200 bg-white p-6" role="status">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Individual KYC status</p>
              <h2 className="mt-2 text-xl font-extrabold text-star-900">{formattedStatus(kycProfile.status)}</h2>
              <p className="mt-2 text-sm leading-6 text-star-muted">Your application status has changed. Contact Starfetch for the next step.</p>
            </section>
          ) : (
            <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="order-2 min-w-0 xl:order-1">
                {stepNotice ? <p role="status" className="mb-5 rounded-xl border border-[#cce7d0] bg-[#eff8f0] px-4 py-3 text-sm font-semibold leading-6 text-star-700">{stepNotice}</p> : null}
                {stepError ? <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">{stepError}</p> : null}
                {kycLoadState === "loading" ? <section className="rounded-xl border border-star-200 bg-white p-6" aria-busy="true"><div className="flex items-center gap-3 text-sm font-semibold text-star-muted"><LoaderCircle size={20} className="animate-spin text-star-700" aria-hidden="true" />Loading your saved KYC progress…</div></section> : null}
                {kycLoadState === "error" ? <section className="rounded-xl border border-star-200 bg-star-50 p-6" role="alert"><h2 className="text-lg font-extrabold text-star-900">We couldn’t load your saved progress.</h2><p className="mt-2 text-sm leading-6 text-star-muted">{kycLoadMessage || "Please try again."}</p><button type="button" onClick={() => { void loadKycProfile(true); }} className="mt-5 min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Retry</button></section> : null}
                {kycLoadState === "ready" && kycProfile ? (
                  <>
          {activeStep === 1 ? (
            <form onSubmit={savePersonalInformation} className="mt-0 rounded-2xl border border-star-200 bg-white p-5 shadow-[0_4px_18px_rgba(0,59,42,0.05)] sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><UserRound size={22} aria-hidden="true" /></span>
                <div>
                  <h2 className="text-xl font-extrabold text-star-900">Personal Information</h2>
                  <p className="mt-1 text-sm leading-6 text-star-muted">Your account-managed name and email are read-only. Complete every visible field below to continue.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="text-sm font-extrabold text-star-900">First name</span><input type="text" value={profile.firstName} readOnly aria-readonly="true" className={`mt-2 ${inputClassName(true)}`} /></label>
                <label className="block"><span className="text-sm font-extrabold text-star-900">Last name</span><input type="text" value={profile.lastName} readOnly aria-readonly="true" className={`mt-2 ${inputClassName(true)}`} /></label>
                <p className="sm:col-span-2 text-xs leading-5 text-star-muted">Your name is managed by your account and cannot be changed here.</p>
                <label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">Email address</span><input type="email" value={profile.email} readOnly aria-readonly="true" className={`mt-2 ${inputClassName(true)}`} /><span className="mt-1 block text-xs text-star-muted">Your email address is managed by your account and cannot be changed here.</span></label>
                <label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">Phone number</span><input type="tel" autoComplete="tel" value={profile.phone ?? ""} onChange={(event) => { setProfile({ ...profile, phone: event.target.value }); markSectionDirty(1); }} placeholder="Add a phone number" className={`mt-2 ${inputClassName()}`} /></label>
              </div>

              <div className="mt-7 border-t border-star-100 pt-6">
                <h3 className="text-base font-extrabold text-star-900">KYC details</h3>
                <p className="mt-1 text-sm leading-6 text-star-muted">Complete every field below to continue to the next current-page section. These details are saved to your owner-scoped Individual KYC profile. Saving a draft does not mean your identity is verified or your account is approved.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Date of birth</span><input type="date" autoComplete="bday" value={localKycDraft.dateOfBirth} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, dateOfBirth: event.target.value })); markSectionDirty(1); }} className={`mt-2 ${inputClassName()}`} /></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Gender</span><select autoComplete="sex" value={localKycDraft.gender} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, gender: event.target.value })); markSectionDirty(1); }} className={`mt-2 ${inputClassName()}`}><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option></select></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Nationality</span><input type="text" autoComplete="off" value={localKycDraft.nationality} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, nationality: event.target.value })); markSectionDirty(1); }} placeholder="Enter two-letter country code (e.g. NG)" className={`mt-2 ${inputClassName()}`} /></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">State of residence</span><input type="text" autoComplete="address-level1" value={localKycDraft.stateOfResidence} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, stateOfResidence: event.target.value })); markSectionDirty(1); }} placeholder="Enter state of residence" className={`mt-2 ${inputClassName()}`} /></label>
                  <label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">Residential address</span><textarea rows={3} autoComplete="street-address" value={localKycDraft.residentialAddress} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, residentialAddress: event.target.value })); markSectionDirty(1); }} placeholder="Enter residential address" className={`mt-2 ${inputClassName()} py-3`} /></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">ID card type</span><select value={localKycDraft.idCardType} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, idCardType: event.target.value })); setDocumentFile(null); setDocumentUploadMessage(""); if (documentInputRef.current) documentInputRef.current.value = ""; markSectionDirty(1); }} className={`mt-2 ${inputClassName()}`}><option value="">Select ID card type</option>{idCardTypes.slice(1).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Occupation</span><input type="text" autoComplete="organization-title" value={localKycDraft.occupation} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, occupation: event.target.value })); markSectionDirty(1); }} placeholder="Enter occupation" className={`mt-2 ${inputClassName()}`} /></label>
                </div>
                {localKycDraft.idCardType ? (
                  <section className="mt-5 rounded-lg border border-star-200 bg-star-50 p-4" aria-labelledby="id-document-upload-heading">
                    <h4 id="id-document-upload-heading" className="text-sm font-extrabold text-star-900">Upload {localKycDraft.idCardType}</h4>
                    <p className="mt-1 text-sm leading-6 text-star-muted">Choose the identity document that matches the selected type. Uploads are sent through the secure private-storage flow and remain subject to manual review.</p>
                    <label className="mt-4 block">
                      <span className="text-sm font-extrabold text-star-900">ID document</span>
                      <input ref={documentInputRef} type="file" accept=".pdf,image/jpeg,image/png" disabled={documentUploadState === "uploading"} onChange={(event) => { setDocumentFile(event.target.files?.[0] ?? null); setDocumentUploadMessage(""); }} className="mt-2 block w-full text-sm text-star-700 file:mr-4 file:rounded-md file:border-0 file:bg-star-700 file:px-3.5 file:py-2 file:text-sm file:font-extrabold file:text-white hover:file:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:opacity-60" />
                      <span className="mt-2 block text-xs leading-5 text-star-muted">PDF, JPEG or PNG, maximum 10 MiB. A selected file is not saved until secure upload finishes.</span>
                    </label>
                    {matchingDocument ? <p className="mt-3 rounded-md border border-[#cce7d0] bg-white px-3 py-2 text-xs leading-5 text-star-700">Matching document on file: {formattedStatus(documentReviewLabel(matchingDocument))}. Upload completion is not document acceptance or KYC approval.</p> : null}
                    <button type="button" onClick={() => { void uploadSelectedIdDocument(); }} disabled={!documentFile || !kycProfile || kycLoadState !== "ready" || documentUploadState === "uploading"} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white transition hover:bg-star-800 disabled:cursor-not-allowed disabled:opacity-60"><ShieldCheck size={16} aria-hidden="true" />{documentUploadState === "uploading" ? "Uploading…" : "Securely upload ID"}</button>
                    {documentUploadMessage ? <p role="status" className="mt-2 text-sm leading-6 text-star-muted">{documentUploadMessage}</p> : null}
                  </section>
                ) : null}
              </div>

              <PepDeclarationDraft value={localPepDeclarationDraft} onChange={(next) => { setLocalPepDeclarationDraft(next); markSectionDirty(1); }} />

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                {notice ? <p role="status" className="text-sm font-semibold text-star-700">{notice}</p> : <span />}
                <button type="submit" disabled={saving || kycLoadState !== "ready"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><Save size={17} aria-hidden="true" />{saving ? "Saving…" : "Save Personal Information"}</button>
              </div>
            </form>
          ) : null}

          {activeStep === 2 ? (
            <div className="mt-0">
              <InvestmentObjectiveRiskProfileDraft value={localInvestmentRiskDraft} onChange={(next) => { setLocalInvestmentRiskDraft(next); markSectionDirty(2); }} />
              <div className="mt-5 flex justify-end"><button type="button" disabled={saving || kycLoadState !== "ready"} onClick={() => { void saveInvestmentProfile(); }} className="min-h-11 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Save Investment Profile</button></div>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="mt-0">
              <SourceOfFundsDraft value={localSourceOfFundsDraft} onChange={(next) => { setLocalSourceOfFundsDraft(next); markSectionDirty(3); }} />
              <div className="mt-5 flex justify-end"><button type="button" disabled={saving || kycLoadState !== "ready"} onClick={() => { void saveSourceOfFunds(); }} className="min-h-11 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Save Source of Funds</button></div>
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="mt-0">
              <BankDetailsDraft value={localBankDetailsDraft} accountNumberMasked={kycProfile?.sections.bankDetails.accountNumberMasked} onChange={(next) => { setLocalBankDetailsDraft(next); markSectionDirty(4); }} />
              <div className="mt-5 flex justify-end"><button type="button" disabled={saving || kycLoadState !== "ready"} onClick={() => { void saveBankDetails(); }} className="min-h-11 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Save Bank Details</button></div>
            </div>
          ) : null}
                    {kycProfile.progression.canSubmit ? (
                      <section className="mt-6 rounded-2xl border border-[#cce7d0] bg-[#eff8f0] p-5" aria-labelledby="kyc-submit-heading">
                        <h2 id="kyc-submit-heading" className="text-base font-extrabold text-star-900">All four sections are ready</h2>
                        <p className="mt-1 text-sm leading-6 text-star-muted">Submit your saved application for review. Submission is not approval or identity verification.</p>
                        <button type="button" onClick={() => { void submitApplication(); }} disabled={submitting || saving} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}{submitting ? "Submitting…" : "Submit for Review"}</button>
                      </section>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="order-1 xl:order-2 xl:sticky xl:top-[96px]">
                <SectionProgress profile={kycProfile} loadState={kycLoadState} activeStep={activeStep} dirtySteps={dirtySteps} onSelect={selectStep} />
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
