"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Info, LoaderCircle, LockKeyhole, Save, ShieldCheck, UserRound } from "lucide-react";
import { completeIndividualKycDocument, createIndividualKycUploadIntent, getIndividualKycProfile, getMyProfile, getSafeErrorMessage, isApiError, saveIndividualKycPersonal, type IndividualAccountProfile, type IndividualKycDocumentType, type IndividualKycProfile, updateMyProfile } from "@/lib/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { BankDetailsDraft, emptyBankDetailsDraft } from "./BankDetailsDraft";
import { InvestmentObjectiveRiskProfileDraft, emptyInvestmentObjectiveRiskDraft } from "./InvestmentObjectiveRiskProfileDraft";
import { PepDeclarationDraft, emptyPepDeclarationDraft } from "./PepDeclarationDraft";
import { SourceOfFundsDraft, emptySourceOfFundsDraft } from "./SourceOfFundsDraft";

type ProfileRequestState = "loading" | "success" | "error";
type ProfileStep = 1 | 2 | 3 | 4;

type LocalKycDraft = {
  dateOfBirth: string;
  gender: string;
  nationality: string;
  residentialAddress: string;
  stateOfResidence: string;
  idCardType: string;
  occupation: string;
};

type UnsupportedProfileSection = {
  title: string;
  description: string;
};

const idCardTypes = ["", "Passport", "PVC", "Driver’s License", "NIN"];
const apiIdCardTypeToLabel: Record<IndividualKycDocumentType, string> = {
  PASSPORT: "Passport", PVC: "PVC", DRIVERS_LICENSE: "Driver’s License", NIN: "NIN",
};
const idCardTypeToApi: Record<string, IndividualKycDocumentType> = {
  Passport: "PASSPORT",
  PVC: "PVC",
  "Driver’s License": "DRIVERS_LICENSE",
  NIN: "NIN",
};

function acceptedDocumentContentType(file: File): "application/pdf" | "image/jpeg" | "image/png" | null {
  const byExtension: Record<string, "application/pdf" | "image/jpeg" | "image/png"> = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
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
const profileSteps: Array<{ step: ProfileStep; title: string; description: string }> = [
  { step: 1, title: "Personal information", description: "Contact details, KYC draft and PEP declaration" },
  { step: 2, title: "Investment profile", description: "Objectives, horizon and risk preferences" },
  { step: 3, title: "Source of funds", description: "Funds and wealth draft" },
  { step: 4, title: "Bank details", description: "Settlement account draft" },
];
const unsupportedSections: UnsupportedProfileSection[] = [
  { title: "Documents", description: "Only the Individual identity-document path is wired to the guarded API; other supporting documents remain unavailable." },
];

function emptyLocalKycDraft(): LocalKycDraft {
  return {
    dateOfBirth: "",
    gender: "",
    nationality: "",
    residentialAddress: "",
    stateOfResidence: "",
    idCardType: "",
    occupation: "",
  };
}

function individualKycErrorMessage(error: unknown): string {
  if (!isApiError(error)) return getSafeErrorMessage(error);
  if (error.code === "FEATURE_UNAVAILABLE" || error.code === "SERVICE_UNAVAILABLE") return "Individual KYC is temporarily unavailable because its required encryption, storage or privacy controls are not ready.";
  if (error.code === "CONFLICT") return "The saved KYC profile changed. Reload its status and retry with the latest version.";
  if (error.code === "VALIDATION_FAILED") return "Review the KYC fields and supported document details, then try again.";
  return getSafeErrorMessage(error);
}

function inputClassName(readOnly = false) {
  return `min-h-11 w-full rounded-md border border-star-200 px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${readOnly ? "cursor-not-allowed bg-star-50 text-star-muted" : "bg-white"}`;
}

function UnsupportedSection({ title, description }: UnsupportedProfileSection) {
  return (
    <article className="rounded-xl border border-star-200 bg-star-50 p-4">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-star-700">
          <ShieldCheck size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-star-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-star-muted">{description}</p>
          <p className="mt-3 text-xs font-bold text-star-700">Unavailable pending approved backend support</p>
        </div>
      </div>
    </article>
  );
}

function SectionProgress({ activeStep, completedThrough, onSelect }: { activeStep: ProfileStep; completedThrough: number; onSelect: (step: ProfileStep) => void }) {
  return (
    <nav className="mt-7 rounded-xl border border-star-200 bg-white p-3 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-4" aria-label="Profile section progress">
      <ol className="grid gap-2 lg:grid-cols-4">
        {profileSteps.map(({ step, title, description }) => {
          const isComplete = step <= completedThrough;
          const isAvailable = step <= Math.min(completedThrough + 1, 4);
          const isActive = step === activeStep;
          const stateLabel = isComplete ? "Completed" : isAvailable ? "Current section" : "Locked";

          return (
            <li key={step}>
              {isAvailable ? (
                <button
                  type="button"
                  onClick={() => onSelect(step)}
                  aria-current={isActive ? "step" : undefined}
                  className={`flex min-h-20 w-full items-start gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${isActive ? "border-star-700 bg-star-50" : "border-star-200 bg-white hover:bg-star-50"}`}
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold ${isComplete ? "bg-star-700 text-star-lime" : "bg-star-100 text-star-700"}`}>
                    {isComplete ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : step}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-star-900">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-star-muted">{description}</span>
                    <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-[0.08em] text-star-700">{stateLabel}</span>
                  </span>
                </button>
              ) : (
                <div className="flex min-h-20 items-start gap-3 rounded-lg border border-star-100 bg-star-50 p-3 text-star-muted" aria-label={`${title}: locked until the preceding section is complete`}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-star-muted"><LockKeyhole size={14} aria-hidden="true" /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5">Complete the preceding section to unlock this form.</span>
                    <span className="mt-1 block text-[0.68rem] font-bold uppercase tracking-[0.08em]">Locked</span>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function IndividualProfileContent() {
  const { status: authStatus, invalidateSession } = useAuth();
  const [requestState, setRequestState] = useState<ProfileRequestState>("loading");
  const [profile, setProfile] = useState<IndividualAccountProfile | null>(null);
  const [kycProfile, setKycProfile] = useState<IndividualKycProfile | null>(null);
  const [kycLoadState, setKycLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUploadState, setDocumentUploadState] = useState<"idle" | "uploading">("idle");
  const [documentUploadMessage, setDocumentUploadMessage] = useState("");
  const [localKycDraft, setLocalKycDraft] = useState<LocalKycDraft>(emptyLocalKycDraft);
  const [localInvestmentRiskDraft, setLocalInvestmentRiskDraft] = useState(emptyInvestmentObjectiveRiskDraft);
  const [localBankDetailsDraft, setLocalBankDetailsDraft] = useState(emptyBankDetailsDraft);
  const [localPepDeclarationDraft, setLocalPepDeclarationDraft] = useState(emptyPepDeclarationDraft);
  const [localSourceOfFundsDraft, setLocalSourceOfFundsDraft] = useState(emptySourceOfFundsDraft);
  const [activeStep, setActiveStep] = useState<ProfileStep>(1);
  const [completedThrough, setCompletedThrough] = useState(0);
  const [stepError, setStepError] = useState("");
  const [stepNotice, setStepNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const requestVersion = useRef(0);
  const kycRequestVersion = useRef(0);

  const loadProfile = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setRequestState("loading");
    setNotice("");

    try {
      const nextProfile = await getMyProfile();
      if (version !== requestVersion.current) return;
      setProfile(nextProfile);
      setRequestState("success");
    } catch (error) {
      if (version !== requestVersion.current) return;
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setProfile(null);
      setRequestState("error");
    }
  }, [invalidateSession]);

  const loadKycProfile = useCallback(async (hydrateDraft = true) => {
    const version = kycRequestVersion.current + 1;
    kycRequestVersion.current = version;
    setKycLoadState("loading");
    try {
      const current = await getIndividualKycProfile();
      if (version !== kycRequestVersion.current) return;
      setKycProfile(current);
      const personal = current.sections.personal;
      if (hydrateDraft && personal) {
        setLocalKycDraft((draft) => ({
          ...draft,
          dateOfBirth: personal.dateOfBirth ?? "",
          gender: personal.gender?.toLowerCase() ?? "",
          nationality: personal.nationality ?? "",
          stateOfResidence: personal.stateOfResidence ?? "",
          residentialAddress: personal.residentialAddress ?? "",
          idCardType: personal.idDocumentType ? apiIdCardTypeToLabel[personal.idDocumentType] : "",
          occupation: personal.occupation ?? "",
        }));
        setLocalPepDeclarationDraft({
          applicantPepStatus: personal.pepStatus?.toLowerCase() ?? "",
          fullName: personal.pepDetails?.fullName ?? "",
          position: personal.pepDetails?.position ?? "",
          country: personal.pepDetails?.country ?? "",
          periodHeld: personal.pepDetails?.periodHeld ?? "",
        });
      }
      setKycLoadState("ready");
    } catch (error) {
      if (version !== kycRequestVersion.current) return;
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setKycProfile(null);
      setKycLoadState("error");
    }
  }, [invalidateSession]);

  async function uploadSelectedIdDocument() {
    if (!documentFile || !kycProfile || documentUploadState === "uploading") return;
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
      // The server advances the optimistic version when issuing a one-time intent.
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
      setDocumentUploadMessage("Document uploaded and marked UNDER REVIEW. Upload completion is not document acceptance or KYC approval.");
      await loadKycProfile(false);
    } catch (error) {
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setDocumentUploadMessage(isApiError(error)
        ? error.code === "FEATURE_UNAVAILABLE"
          ? bytesTransferred
            ? "The file may have reached private storage, but the API could not confirm its upload. It is not verified or approved; contact support before retrying."
            : "Document uploads are disabled until approved private storage, encryption, retention and residency controls are operational. No file was transferred."
          : individualKycErrorMessage(error)
        : "The secure upload could not be completed. Check the connection and try again; no document is treated as verified.");
    } finally {
      setDocumentUploadState("idle");
    }
  }

  useEffect(() => {
    if (authStatus === "authenticated") {
      void loadProfile();
      void loadKycProfile();
    } else {
      kycRequestVersion.current += 1;
      setKycProfile(null);
      setKycLoadState("loading");
      setDocumentFile(null);
      setDocumentUploadMessage("");
      setLocalKycDraft(emptyLocalKycDraft());
      setLocalInvestmentRiskDraft(emptyInvestmentObjectiveRiskDraft());
      setLocalBankDetailsDraft(emptyBankDetailsDraft());
      setLocalPepDeclarationDraft(emptyPepDeclarationDraft());
      setLocalSourceOfFundsDraft(emptySourceOfFundsDraft());
      setActiveStep(1);
      setCompletedThrough(0);
      setStepError("");
      setStepNotice("");
    }

    return () => {
      requestVersion.current += 1;
      kycRequestVersion.current += 1;
    };
  }, [authStatus, loadKycProfile, loadProfile]);

  function resetCompletionFrom(step: ProfileStep) {
    setCompletedThrough((current) => Math.min(current, step - 1));
    setStepError("");
    setStepNotice("");
  }

  function selectStep(step: ProfileStep) {
    if (step > Math.min(completedThrough + 1, 4)) return;
    setActiveStep(step);
    setStepError("");
    setStepNotice("");
  }

  function getPersonalInformationError() {
    if (!profile?.phone?.trim()) return "Enter your phone number to complete Personal Information.";
    const requiredKycFields: Array<[string, string]> = [
      ["date of birth", localKycDraft.dateOfBirth],
      ["gender", localKycDraft.gender],
      ["nationality", localKycDraft.nationality],
      ["residential address", localKycDraft.residentialAddress],
      ["state of residence", localKycDraft.stateOfResidence],
      ["ID card type", localKycDraft.idCardType],
      ["occupation", localKycDraft.occupation],
    ];
    const missingField = requiredKycFields.find(([, value]) => !value.trim());
    if (missingField) return `Complete your ${missingField[0]} to continue.`;
    if (!localPepDeclarationDraft.applicantPepStatus) return "Select Yes or No in the PEP Declaration to continue.";
    if (localPepDeclarationDraft.applicantPepStatus === "yes") {
      const missingPep = [localPepDeclarationDraft.fullName, localPepDeclarationDraft.position, localPepDeclarationDraft.country, localPepDeclarationDraft.periodHeld].some((value) => !value.trim());
      if (missingPep) return "Complete the name, position, country and period held for the PEP declaration.";
    }
    return "";
  }

  function getInvestmentProfileError() {
    const requiredFields: Array<[string, string]> = [
      ["primary investment objective", localInvestmentRiskDraft.primaryObjective],
      ["risk tolerance", localInvestmentRiskDraft.riskTolerance],
      ["investment horizon", localInvestmentRiskDraft.investmentHorizon],
      ["investment knowledge and experience", localInvestmentRiskDraft.knowledgeAndExperience],
      ["expected withdrawals", localInvestmentRiskDraft.expectedWithdrawals],
      ["withdrawal frequency", localInvestmentRiskDraft.withdrawalFrequency],
      ["annual income", localInvestmentRiskDraft.annualIncome],
      ["estimated net worth", localInvestmentRiskDraft.estimatedNetWorth],
    ];
    const missingField = requiredFields.find(([, value]) => !value.trim());
    return missingField ? `Complete your ${missingField[0]} to continue.` : "";
  }

  function getSourceOfFundsError() {
    if (!localSourceOfFundsDraft.selectedSources.length) return "Select at least one source of funds to continue.";
    if (localSourceOfFundsDraft.selectedSources.includes("Other (specify)") && !localSourceOfFundsDraft.otherSource.trim()) {
      return "Specify the other source of funds to continue.";
    }
    if (!localSourceOfFundsDraft.expectedAnnualInflow.trim()) return "Enter the expected annual inflow to continue.";
    if (!localSourceOfFundsDraft.expectedTransactionFrequency.trim()) return "Enter the expected transaction frequency to continue.";
    return "";
  }

  function getBankDetailsError() {
    const requiredFields: Array<[string, string]> = [
      ["bank name", localBankDetailsDraft.bankName],
      ["account number", localBankDetailsDraft.accountNumber],
      ["account name", localBankDetailsDraft.accountName],
      ["account type", localBankDetailsDraft.accountType],
      ["BVN-linked account confirmation", localBankDetailsDraft.bvnLinkedToAccount],
    ];
    const missingField = requiredFields.find(([, value]) => !value.trim());
    return missingField ? `Complete your ${missingField[0]} to finish this current-page draft.` : "";
  }

  async function savePersonalInformation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;

    const validationError = getPersonalInformationError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }

    setSaving(true);
    setNotice("");
    setStepError("");
    let kycDetailsSaved = false;
    try {
      // Names remain account-managed. Personal KYC uses its own encrypted,
      // versioned endpoint and is not sent through the profile update contract.
      if (!kycProfile || kycLoadState !== "ready") throw new Error("KYC_STATUS_UNAVAILABLE");
      if (!/^[A-Za-z]{2}$/.test(localKycDraft.nationality.trim())) {
        throw new Error("Enter nationality as a two-letter ISO country code (for example, NG).");
      }
      const personalResult = await saveIndividualKycPersonal({
        version: kycProfile.version,
        dateOfBirth: localKycDraft.dateOfBirth,
        gender: localKycDraft.gender.toUpperCase() as "MALE" | "FEMALE",
        nationality: localKycDraft.nationality.trim().toUpperCase(),
        stateOfResidence: localKycDraft.stateOfResidence.trim(),
        residentialAddress: localKycDraft.residentialAddress.trim(),
        idDocumentType: idCardTypeToApi[localKycDraft.idCardType],
        occupation: localKycDraft.occupation.trim(),
        pepStatus: localPepDeclarationDraft.applicantPepStatus.toUpperCase() as "YES" | "NO",
        ...(localPepDeclarationDraft.applicantPepStatus === "yes" ? { pepDetails: {
          fullName: localPepDeclarationDraft.fullName.trim(),
          position: localPepDeclarationDraft.position.trim(),
          country: localPepDeclarationDraft.country.trim(),
          periodHeld: localPepDeclarationDraft.periodHeld.trim(),
        } } : {}),
      });
      setKycProfile((current) => current ? { ...current, version: personalResult.version, sectionStatuses: personalResult.sectionStatuses, progression: personalResult.progression } : current);
      kycDetailsSaved = true;
      const savedProfile = await updateMyProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim() || null,
      });
      setProfile(savedProfile);
      setCompletedThrough(1);
      setActiveStep(2);
      setNotice("Phone and Personal KYC details have been saved to their account APIs. KYC submission requires a matching identity document upload; upload or document review does not itself approve customer identity.");
      setStepNotice("Personal details are saved as a KYC draft. This is not verification or approval. Continue with your Investment Profile.");
    } catch (error) {
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      const safeMessage = error instanceof Error && error.message === "Enter nationality as a two-letter ISO country code (for example, NG)."
        ? error.message
        : error instanceof Error && error.message === "KYC_STATUS_UNAVAILABLE"
          ? "Saved KYC status is unavailable. Reload the page before attempting to save."
          : individualKycErrorMessage(error);
      setNotice(kycDetailsSaved ? `Personal KYC draft saved; the profile phone update did not finish. ${safeMessage}` : safeMessage);
    } finally {
      setSaving(false);
    }
  }

  function completeInvestmentProfile() {
    const validationError = getInvestmentProfileError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }
    setCompletedThrough(2);
    setActiveStep(3);
    setStepError("");
    setStepNotice("Investment Profile is complete for this page. Continue with Source of Funds.");
  }

  function completeSourceOfFunds() {
    const validationError = getSourceOfFundsError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }
    setCompletedThrough(3);
    setActiveStep(4);
    setStepError("");
    setStepNotice("Source of Funds is complete for this page. Continue with Bank Details.");
  }

  function completeBankDetails() {
    const validationError = getBankDetailsError();
    if (validationError) {
      setStepError(validationError);
      setStepNotice("");
      return;
    }
    setCompletedThrough(4);
    setStepError("");
    setStepNotice("All current-page profile sections are complete. You can review any completed section above; local draft details reset when you leave or refresh this page.");
  }

  return (
    <section className="mx-auto max-w-6xl" aria-labelledby="individual-profile-heading">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-extrabold text-star-700 no-underline transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
        <ArrowLeft size={17} aria-hidden="true" />
        Return to Dashboard
      </Link>

      <div className="mt-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Individual account</p>
        <h1 id="individual-profile-heading" className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted">Complete each current-page section in sequence. Earlier completed sections remain available for review and editing.</p>
      </div>

      {requestState === "loading" ? (
        <section className="mt-7 rounded-xl border border-star-200 bg-white p-6" aria-busy="true">
          <div className="flex items-center gap-3 text-sm font-semibold text-star-muted"><LoaderCircle size={20} className="animate-spin text-star-700" aria-hidden="true" />Loading your profile…</div>
        </section>
      ) : null}

      {requestState === "error" ? (
        <section className="mt-7 rounded-xl border border-star-200 bg-star-50 p-6" role="alert">
          <h2 className="text-lg font-extrabold text-star-900">We couldn&apos;t load your profile.</h2>
          <p className="mt-2 text-sm text-star-muted">Please try again.</p>
          <button type="button" onClick={() => void loadProfile()} className="mt-5 min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Retry</button>
        </section>
      ) : null}

      {requestState === "success" && profile ? (
        <>
          <SectionProgress activeStep={activeStep} completedThrough={completedThrough} onSelect={selectStep} />

          <section className="mt-5 rounded-xl border border-star-200 bg-white p-5" aria-labelledby="individual-kyc-status-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 id="individual-kyc-status-heading" className="text-base font-extrabold text-star-900">Saved KYC status</h2><p className="mt-1 text-sm leading-6 text-star-muted">This status comes from the authenticated Individual KYC service; local page drafts are not counted as saved.</p></div>
              {kycLoadState === "ready" && kycProfile ? <span className="w-fit rounded-full bg-star-100 px-3 py-1 text-xs font-extrabold text-star-700">{kycProfile.status.replaceAll("_", " ")}</span> : null}
            </div>
            {kycLoadState === "loading" ? <p className="mt-3 text-sm text-star-muted">Loading saved KYC status…</p> : null}
            {kycLoadState === "error" ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">Saved KYC status is unavailable for this account or the service is not configured. No local draft is represented as persisted.</p> : null}
            {kycLoadState === "ready" && kycProfile ? <><div className="mt-4 grid gap-2 sm:grid-cols-4">{Object.entries({ Personal: kycProfile.sectionStatuses.personal, Investment: kycProfile.sectionStatuses.investment, "Source of funds": kycProfile.sectionStatuses.sourceOfFunds, Bank: kycProfile.sectionStatuses.bank }).map(([label, state]) => <div key={label} className="rounded-lg bg-star-50 px-3 py-2"><p className="text-xs font-bold text-star-muted">{label}</p><p className="mt-1 text-xs font-extrabold text-star-900">{state.replaceAll("_", " ")}</p></div>)}</div><p className="mt-3 text-xs text-star-muted">{kycProfile.documents.length ? `${kycProfile.documents.length} identity document record(s).` : "No identity document has been uploaded."} Uploads enter manual document review; upload success is not KYC approval.</p>{kycProfile.documents.length ? <ul className="mt-3 space-y-2">{kycProfile.documents.map((document) => <li key={document.id} className="rounded-lg border border-star-100 px-3 py-2 text-xs"><span className="font-bold text-star-900">{document.originalFilename}</span><span className="ml-2 text-star-muted">{document.status.replaceAll("_", " ")} · review {document.manualReviewStatus.replaceAll("_", " ")}</span></li>)}</ul> : null}</> : null}
          </section>

          {stepNotice ? <p role="status" className="mt-5 rounded-lg border border-[#cce7d0] bg-[#eff8f0] px-4 py-3 text-sm font-semibold leading-6 text-star-700">{stepNotice}</p> : null}
          {stepError ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">{stepError}</p> : null}

          {activeStep === 1 ? (
            <form onSubmit={savePersonalInformation} className="mt-7 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6">
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
                <label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">Phone number</span><input type="tel" autoComplete="tel" value={profile.phone ?? ""} onChange={(event) => { setProfile({ ...profile, phone: event.target.value }); resetCompletionFrom(1); }} placeholder="Add a phone number" className={`mt-2 ${inputClassName()}`} /></label>
              </div>

              <div className="mt-7 border-t border-star-100 pt-6">
                <h3 className="text-base font-extrabold text-star-900">KYC details</h3>
                <p className="mt-1 text-sm leading-6 text-star-muted">Your phone is saved to the account profile. These personal fields and structured PEP details are saved separately as a versioned KYC draft, not as an approval. Investment, Source of Funds and Bank sections remain page-only until their approved option catalogues are available.</p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Date of birth</span><input type="date" autoComplete="bday" value={localKycDraft.dateOfBirth} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, dateOfBirth: event.target.value })); resetCompletionFrom(1); }} className={`mt-2 ${inputClassName()}`} /></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Gender</span><select autoComplete="sex" value={localKycDraft.gender} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, gender: event.target.value })); resetCompletionFrom(1); }} className={`mt-2 ${inputClassName()}`}><option value="">Select gender</option><option value="male">Male</option><option value="female">Female</option></select></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Nationality</span><input type="text" autoComplete="off" value={localKycDraft.nationality} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, nationality: event.target.value })); resetCompletionFrom(1); }} placeholder="Two-letter country code (e.g. NG)" className={`mt-2 ${inputClassName()}`} /></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">State of residence</span><input type="text" autoComplete="address-level1" value={localKycDraft.stateOfResidence} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, stateOfResidence: event.target.value })); resetCompletionFrom(1); }} placeholder="Enter state of residence" className={`mt-2 ${inputClassName()}`} /></label>
                  <label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">Residential address</span><textarea rows={3} autoComplete="street-address" value={localKycDraft.residentialAddress} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, residentialAddress: event.target.value })); resetCompletionFrom(1); }} placeholder="Enter residential address" className={`mt-2 ${inputClassName()} py-3`} /></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">ID card type</span><select value={localKycDraft.idCardType} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, idCardType: event.target.value })); setDocumentFile(null); setDocumentUploadMessage(""); resetCompletionFrom(1); }} className={`mt-2 ${inputClassName()}`}><option value="">Select ID card type</option>{idCardTypes.slice(1).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                  <label className="block"><span className="text-sm font-extrabold text-star-900">Occupation</span><input type="text" autoComplete="organization-title" value={localKycDraft.occupation} onChange={(event) => { setLocalKycDraft((current) => ({ ...current, occupation: event.target.value })); resetCompletionFrom(1); }} placeholder="Enter occupation" className={`mt-2 ${inputClassName()}`} /></label>
                </div>
                {localKycDraft.idCardType ? (
                  <section className="mt-5 rounded-lg border border-star-200 bg-star-50 p-4" aria-labelledby="id-document-upload-heading">
                    <h4 id="id-document-upload-heading" className="text-sm font-extrabold text-star-900">Upload {localKycDraft.idCardType}</h4>
                    <p className="mt-1 text-sm leading-6 text-star-muted">Choose your {localKycDraft.idCardType} document to complete this current-page section.</p>
                    <label className="mt-4 block">
                      <span className="text-sm font-extrabold text-star-900">ID document</span>
                      <input type="file" accept=".pdf,image/jpeg,image/png" disabled={documentUploadState === "uploading"} onChange={(event) => { setDocumentFile(event.target.files?.[0] ?? null); setDocumentUploadMessage(""); resetCompletionFrom(1); }} className="mt-2 block w-full text-sm text-star-700 file:mr-4 file:rounded-md file:border-0 file:bg-star-700 file:px-3.5 file:py-2 file:text-sm file:font-extrabold file:text-white hover:file:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:opacity-60" />
                      <span className="mt-2 block text-xs leading-5 text-star-muted">PDF, JPEG or PNG, maximum 10 MiB. Files are sent only after requesting a short-lived authenticated upload intent; the API keeps uploads disabled until operational approvals are complete.</span>
                      <button type="button" onClick={() => { void uploadSelectedIdDocument(); }} disabled={!documentFile || !kycProfile || kycLoadState !== "ready" || documentUploadState === "uploading"} className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white transition hover:bg-star-800 disabled:cursor-not-allowed disabled:opacity-60"><ShieldCheck size={16} aria-hidden="true" />{documentUploadState === "uploading" ? "Uploading…" : "Securely upload ID"}</button>
                      {documentUploadMessage ? <p role="status" className="mt-2 text-sm leading-6 text-star-muted">{documentUploadMessage}</p> : null}
                    </label>
                  </section>
                ) : null}
              </div>

              <PepDeclarationDraft value={localPepDeclarationDraft} onChange={(next) => { setLocalPepDeclarationDraft(next); resetCompletionFrom(1); }} />

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                {notice ? <p role="status" className="text-sm font-semibold text-star-700">{notice}</p> : <span />}
                <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><Save size={17} aria-hidden="true" />{saving ? "Saving…" : "Complete Personal Information"}</button>
              </div>
            </form>
          ) : null}

          {activeStep === 2 ? (
            <div className="mt-7">
              <InvestmentObjectiveRiskProfileDraft value={localInvestmentRiskDraft} onChange={(next) => { setLocalInvestmentRiskDraft(next); resetCompletionFrom(2); }} />
              <div className="mt-5 flex justify-end"><button type="button" onClick={completeInvestmentProfile} className="min-h-11 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Complete Investment Profile</button></div>
            </div>
          ) : null}

          {activeStep === 3 ? (
            <div className="mt-7">
              <SourceOfFundsDraft value={localSourceOfFundsDraft} onChange={(next) => { setLocalSourceOfFundsDraft(next); resetCompletionFrom(3); }} />
              <div className="mt-5 flex justify-end"><button type="button" onClick={completeSourceOfFunds} className="min-h-11 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Complete Source of Funds</button></div>
            </div>
          ) : null}

          {activeStep === 4 ? (
            <div className="mt-7">
              <BankDetailsDraft value={localBankDetailsDraft} onChange={(next) => { setLocalBankDetailsDraft(next); resetCompletionFrom(4); }} />
              <div className="mt-5 flex justify-end"><button type="button" onClick={completeBankDetails} className="min-h-11 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Complete Bank Details</button></div>
            </div>
          ) : null}

          {completedThrough === 4 ? (
            <section className="mt-7 rounded-xl border border-[#cce7d0] bg-[#eff8f0] p-5" aria-labelledby="profile-draft-complete-heading">
              <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-star-700 text-star-lime"><Check size={20} strokeWidth={3} aria-hidden="true" /></span><div><h2 id="profile-draft-complete-heading" className="text-base font-extrabold text-star-900">Current-page sections complete</h2><p className="mt-1 text-sm leading-6 text-star-muted">You may review an unlocked section above. This does not confirm KYC or submit any local draft data; the drafts reset when you leave or refresh this page.</p></div></div>
            </section>
          ) : null}

          <section className="mt-7" aria-labelledby="onboarding-unavailable-heading">
            <div className="flex gap-3 rounded-xl border border-[#d9eac8] bg-[linear-gradient(115deg,#f6faee_0%,#edf6e3_100%)] p-4"><Info size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><div><h2 id="onboarding-unavailable-heading" className="text-base font-extrabold text-star-900">Additional onboarding is not available yet</h2><p className="mt-1 text-sm leading-6 text-star-muted">These areas have no approved backend storage or verification workflow. The portal does not collect or claim to save this information.</p></div></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">{unsupportedSections.map((section) => <UnsupportedSection key={section.title} {...section} />)}</div>
          </section>
        </>
      ) : null}
    </section>
  );
}
