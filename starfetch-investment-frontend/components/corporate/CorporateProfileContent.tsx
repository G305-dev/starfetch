"use client";

import { AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, LoaderCircle, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { CorporateDocumentUploadSection } from "./CorporateDocumentUploadSection";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  completeCorporateApplicantIdentity,
  getCorporateProfile,
  getMyCorporateApplications,
  isApiError,
  saveCorporateProfileBankDetails,
  saveCorporateProfileCompanyDetails,
  saveCorporateProfileInvestmentProfile,
  saveCorporateProfileSourceOfFunds,
  type ApiError,
  type AuthUser,
} from "@/lib/api/client";
import { getCorporateApplicationDisplay, isCorporateDraftEditable, type CorporateApplicationDiscoveryItem } from "@/lib/corporate/application";
import { getCreatedCorporateAccountId } from "@/lib/corporate/application-handoff";
import {
  corporateAnnualInflowPattern,
  corporateApplicantPhonePattern,
  corporateInvestmentHorizonOptions,
  corporateInvestmentObjectives,
  corporateRiskToleranceOptions,
  corporateSourceOfFundsOptions,
  emptyCorporateBankDetails,
  emptyCorporateCompanyDetails,
  emptyCorporateInvestmentProfile,
  emptyCorporateSourceOfFunds,
  isAmbiguousCorporateWithdrawalAmount,
  type CorporateApplicantInfo,
  type CorporateBankDetails,
  type CorporateCompanyDetails,
  type CorporateInvestmentProfile,
  type CorporateProfileSectionStatus,
  type CorporateProfileView,
  type CorporateSourceOfFunds,
} from "@/lib/corporate/profile";

type SectionKey = "companyDetails" | "investmentProfile" | "sourceOfFunds" | "bankDetails";
type FieldErrors = Record<string, string>;
type CompanyForm = CorporateCompanyDetails;
type BankForm = CorporateBankDetails;
type SectionDefinition = { key: SectionKey; title: string; shortTitle: string; description: string };
type LoadState = "loading" | "ready" | "empty" | "error";
type SavedStatuses = Record<SectionKey, CorporateProfileSectionStatus>;

const sections: SectionDefinition[] = [
  { key: "companyDetails", title: "Corporate Applicant Information & Company Details", shortTitle: "Company details", description: "Review the read-only account information and complete the registered-company details." },
  { key: "investmentProfile", title: "Investment Objective & Risk Profile", shortTitle: "Investment profile", description: "Enter the company’s investment objectives, risk tolerance, horizon, and liquidity expectations." },
  { key: "sourceOfFunds", title: "Source of Funds and Wealth", shortTitle: "Source of funds", description: "Select the source or sources of funds and enter the expected inflow and transaction frequency." },
  { key: "bankDetails", title: "Bank Details", shortTitle: "Bank details", description: "Enter the bank account details for the company’s distributions." },
];

const initialCompanyForm: CompanyForm = emptyCorporateCompanyDetails();
const initialInvestmentForm: CorporateInvestmentProfile = emptyCorporateInvestmentProfile();
const initialSourceForm: CorporateSourceOfFunds = emptyCorporateSourceOfFunds();
const initialBankForm: BankForm = emptyCorporateBankDetails();
const notStartedStatuses: SavedStatuses = { companyDetails: "NOT_STARTED", investmentProfile: "NOT_STARTED", sourceOfFunds: "NOT_STARTED", bankDetails: "NOT_STARTED" };

function furthestUnlockedSection(completed: ReadonlySet<SectionKey>) {
  let index = 0;
  while (index < sections.length - 1 && completed.has(sections[index].key)) index += 1;
  return index;
}

function localTodayISODate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function dateIsValidAndNotFuture(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= localTodayISODate();
}

/** Removes only presentation separators; the backend accepts digits with up to two decimals. */
function normaliseAnnualInflow(value: string) {
  return value.replace(/[\s,₦]/g, "");
}

/** Client checks mirror the backend DTOs for early feedback; the backend remains authoritative. */
function validateSection(index: number, company: CompanyForm, investment: CorporateInvestmentProfile, source: CorporateSourceOfFunds, bank: BankForm, hasSavedAccountNumber: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const required = (name: string, value: string, label: string, max?: number) => {
    if (!value.trim()) errors[name] = `Enter ${label}.`;
    else if (max && value.trim().length > max) errors[name] = `Use ${max} characters or fewer.`;
  };

  if (index === 0) {
    required("rcNumber", company.rcNumber, "the RC number", 255);
    if (!company.dateOfIncorporation) errors.dateOfIncorporation = "Select the date of incorporation.";
    else if (!dateIsValidAndNotFuture(company.dateOfIncorporation)) errors.dateOfIncorporation = "Enter a valid incorporation date that is not in the future.";
    // The TIN is write-only: blank keeps the encrypted TIN already on file.
    if (company.taxIdentificationNumber.trim().length > 256) errors.taxIdentificationNumber = "Use 256 characters or fewer.";
    required("registeredAddress", company.registeredAddress, "the registered address", 255);
    required("city", company.city, "the city", 120);
    required("state", company.state, "the state", 120);
  } else if (index === 1) {
    if (!(corporateInvestmentObjectives as readonly string[]).includes(investment.primaryObjective)) errors.primaryObjective = "Select a primary investment objective.";
    if (!(corporateRiskToleranceOptions as readonly string[]).includes(investment.riskTolerance)) errors.riskTolerance = "Select a risk-tolerance level.";
    if (!(corporateInvestmentHorizonOptions as readonly string[]).includes(investment.investmentHorizon)) errors.investmentHorizon = "Select an investment horizon.";
    required("expectedWithdrawals", investment.expectedWithdrawals, "expected withdrawals or enter ‘No withdrawals planned’", 120);
    if (!errors.expectedWithdrawals && isAmbiguousCorporateWithdrawalAmount(investment.expectedWithdrawals)) errors.expectedWithdrawals = "Enter a clear naira amount such as ₦500,000, or text such as ‘No withdrawals planned’.";
    required("withdrawalFrequency", investment.withdrawalFrequency, "the withdrawal frequency", 120);
    if (investment.restrictionsOrExclusions.trim().length > 500) errors.restrictionsOrExclusions = "Use 500 characters or fewer.";
  } else if (index === 2) {
    if (!source.selectedSources.length) errors.selectedSources = "Select at least one source of funds.";
    if (source.selectedSources.includes("Other (specify)") && !source.otherSource.trim()) errors.otherSource = "Describe the other source of funds.";
    else if (source.otherSource.trim().length > 500) errors.otherSource = "Use 500 characters or fewer.";
    if (!source.expectedAnnualInflow.trim()) errors.expectedAnnualInflow = "Enter the expected annual inflow.";
    else if (!corporateAnnualInflowPattern.test(normaliseAnnualInflow(source.expectedAnnualInflow))) errors.expectedAnnualInflow = "Enter a naira amount with up to two decimal places, e.g. 1000000 or 1000000.50.";
    required("expectedTransactionFrequency", source.expectedTransactionFrequency, "the expected transaction frequency", 120);
  } else {
    required("bankName", bank.bankName, "the bank name", 120);
    if (!/^\d{10}$/.test(bank.accountNumber.trim())) errors.accountNumber = hasSavedAccountNumber ? "Re-enter the full 10-digit NUBAN account number to save bank details." : "Enter a valid 10-digit NUBAN account number.";
    required("accountName", bank.accountName, "the account name", 160);
    required("accountType", bank.accountType, "the account type", 80);
    if (bank.bvnLinkedToAccount === null) errors.bvnLinkedToAccount = "Select Yes or No.";
  }
  return errors;
}

/** Read-only applicant identity: the backend profile projection first, then the authenticated session. */
function applicantInfo(user: { email: string; companyName?: string; companyPhoneNumber?: string }, profile: CorporateProfileView | null): CorporateApplicantInfo {
  return {
    companyName: profile?.applicant.companyName?.trim() || user.companyName?.trim() || "",
    companyPhoneNumber: profile?.applicant.companyPhoneNumber?.trim() || user.companyPhoneNumber?.trim() || "",
    email: profile?.applicant.email || user.email,
  };
}

function companyFormFrom(profile: CorporateProfileView): CompanyForm {
  return {
    rcNumber: profile.canonicalDetails.rcNumber,
    dateOfIncorporation: profile.canonicalDetails.dateOfIncorporation,
    // Never prefilled: the backend returns only a masked projection.
    taxIdentificationNumber: "",
    registeredAddress: profile.companyDetails.registeredAddress ?? "",
    city: profile.companyDetails.city ?? "",
    state: profile.companyDetails.state ?? "",
  };
}

function investmentFormFrom(profile: CorporateProfileView): CorporateInvestmentProfile {
  const saved = profile.investmentProfile;
  return {
    primaryObjective: saved.primaryObjective ?? "",
    riskTolerance: saved.riskTolerance ?? "",
    investmentHorizon: saved.investmentHorizon ?? "",
    expectedWithdrawals: saved.expectedWithdrawals ?? "",
    withdrawalFrequency: saved.withdrawalFrequency ?? "",
    restrictionsOrExclusions: saved.restrictionsOrExclusions ?? "",
  };
}

function sourceFormFrom(profile: CorporateProfileView): CorporateSourceOfFunds {
  const saved = profile.sourceOfFunds;
  return {
    selectedSources: saved.selectedSources.filter((value) => (corporateSourceOfFundsOptions as readonly string[]).includes(value)),
    otherSource: saved.otherSource ?? "",
    expectedAnnualInflow: saved.expectedAnnualInflow ?? "",
    expectedTransactionFrequency: saved.expectedTransactionFrequency ?? "",
  };
}

function bankFormFrom(profile: CorporateProfileView): BankForm {
  const saved = profile.bankDetails;
  return {
    bankName: saved.bankName ?? "",
    // Never prefilled: only accountNumberMasked is returned by the backend.
    accountNumber: "",
    accountName: saved.accountName ?? "",
    accountType: saved.accountType ?? "",
    bvnLinkedToAccount: saved.bvnLinkedToAccount,
  };
}

function completedFrom(profile: CorporateProfileView) {
  return new Set(sections.filter((section) => profile.sectionStatuses[section.key] === "COMPLETE").map((section) => section.key));
}

function initialStepFor(profile: CorporateProfileView) {
  const furthest = furthestUnlockedSection(completedFrom(profile));
  const nextIndex = profile.progress.nextSection ? sections.findIndex((section) => section.key === profile.progress.nextSection) : sections.length - 1;
  return Math.max(0, Math.min(nextIndex < 0 ? furthest : nextIndex, furthest));
}

function errorReference(error: unknown) {
  if (!isApiError(error)) return "";
  const parts = [error.status ? `HTTP ${error.status}` : null, error.serverCode ?? null, error.requestId ? `request ${error.requestId}` : null].filter(Boolean);
  return parts.length ? ` Reference: ${parts.join(" · ")}.` : "";
}

function retryAfterText(error: ApiError) {
  return error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} seconds.` : " Please try again later.";
}

/** Truthful load-failure description. The backend decides access; the frontend only explains it. */
function describeLoadError(error: unknown, user: AuthUser) {
  if (!isApiError(error)) return `We could not load your Corporate Profile. Please try again.${errorReference(error)}`;
  switch (error.code) {
    case "EMAIL_NOT_VERIFIED":
      return `Verify your email address before accessing the Corporate Profile.${errorReference(error)}`;
    case "FORBIDDEN":
      if (user.primaryAccountType === "INDIVIDUAL") return `Starfetch did not authorise Corporate access for this signed-in account because it is classified as an Individual account. Corporate Profile data cannot be shown or saved. Contact Starfetch support if this account should be a Corporate account.${errorReference(error)}`;
      if (user.primaryAccountType === null) return `Starfetch did not authorise Corporate access because this signed-in account has not yet been classified as a Corporate account. Contact Starfetch support to review the account classification.${errorReference(error)}`;
      return `Starfetch did not authorise Corporate Profile access for this signed-in account.${errorReference(error)}`;
    case "NOT_FOUND":
      return `This Corporate application is not available to your account.${errorReference(error)}`;
    case "RATE_LIMITED":
      return `Corporate Profile requests are temporarily rate limited.${retryAfterText(error)}${errorReference(error)}`;
    case "UNAUTHENTICATED":
      return `Your session has ended. Please sign in again.${errorReference(error)}`;
    case "NETWORK_ERROR":
      return `We could not reach Starfetch securely. Check your connection and try again.${errorReference(error)}`;
    case "SERVICE_UNAVAILABLE":
    case "FEATURE_UNAVAILABLE":
      return `The Corporate Profile is temporarily unavailable. Please try again later.${errorReference(error)}`;
    default:
      return `We could not load your Corporate Profile. Please try again.${errorReference(error)}`;
  }
}

/** Truthful save-failure description. A failed save never marks a section complete. */
function describeSaveError(error: unknown, sectionKey: SectionKey, tinEntered: boolean) {
  const reference = errorReference(error);
  if (!isApiError(error)) return `We could not save this section. Nothing was marked as saved.${reference}`;
  switch (error.code) {
    case "VALIDATION_FAILED":
      return `Starfetch did not accept this section. Review the highlighted information and try again. Nothing was saved.${reference}`;
    case "UNAUTHENTICATED":
      return `Your session has ended. Please sign in again. Nothing was saved.${reference}`;
    case "EMAIL_NOT_VERIFIED":
      return `Verify your email address before saving the Corporate Profile. Nothing was saved.${reference}`;
    case "FORBIDDEN":
      return error.serverCode === "CSRF_VALIDATION_FAILED"
        ? `Starfetch could not verify this request’s security token. Refresh the page and try again. Nothing was saved.${reference}`
        : `Starfetch did not authorise this save for the signed-in account. Nothing was saved.${reference}`;
    case "NOT_FOUND":
      return `This Corporate application is not available to your account. Nothing was saved.${reference}`;
    case "RATE_LIMITED":
      return `Too many Corporate Profile saves were made.${retryAfterText(error)} Nothing was saved.${reference}`;
    case "SERVICE_UNAVAILABLE":
    case "FEATURE_UNAVAILABLE":
      if (sectionKey === "bankDetails") return `Bank details could not be saved because secure bank-account encryption is currently unavailable. Nothing was saved. Please try again later.${reference}`;
      if (sectionKey === "companyDetails" && tinEntered) return `The new TIN could not be saved because secure Corporate TIN processing is currently unavailable. Nothing was saved. Leave the TIN blank to keep the TIN already on file, or try again later.${reference}`;
      return `This section could not be saved because a required Starfetch service is unavailable. Nothing was saved.${reference}`;
    case "NETWORK_ERROR":
      return `We could not confirm the save because Starfetch could not be reached. Reload the profile to see what is currently saved.${reference}`;
    default:
      return `We could not save this section. Nothing was marked as saved.${reference}`;
  }
}

const fieldMessages: Record<string, string> = {
  rcNumber: "Enter a valid RC number.",
  dateOfIncorporation: "Enter a valid incorporation date that is not in the future.",
  taxIdentificationNumber: "Enter a valid TIN, or leave it blank to keep the TIN on file.",
  registeredAddress: "Enter the registered address.",
  city: "Enter the city.",
  state: "Enter the state.",
  primaryObjective: "Select a primary investment objective.",
  riskTolerance: "Select a risk-tolerance level.",
  investmentHorizon: "Select an investment horizon.",
  expectedWithdrawals: "Enter a clear naira amount or text such as ‘No withdrawals planned’.",
  withdrawalFrequency: "Enter the withdrawal frequency.",
  restrictionsOrExclusions: "Use 500 characters or fewer.",
  selectedSources: "Select at least one source of funds.",
  otherSource: "Describe the other source of funds.",
  expectedAnnualInflow: "Enter a naira amount with up to two decimal places.",
  expectedTransactionFrequency: "Enter the expected transaction frequency.",
  bankName: "Enter the bank name.",
  accountNumber: "Enter a valid 10-digit NUBAN account number.",
  accountName: "Enter the account name.",
  accountType: "Enter the account type.",
  bvnLinkedToAccount: "Select Yes or No.",
};

function backendFieldErrors(error: unknown): FieldErrors {
  if (!isApiError(error) || !error.fieldNames) return {};
  return Object.fromEntries(error.fieldNames.filter((name) => name in fieldMessages).map((name) => [name, fieldMessages[name]]));
}

export function CorporateProfileContent() {
  const { status: authStatus, user, refreshSession } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [showDocuments, setShowDocuments] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<"NOT_STARTED" | "DRAFT" | "COMPLETE" | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<SectionKey>>(() => new Set());
  const [company, setCompany] = useState<CompanyForm>(initialCompanyForm);
  const [investment, setInvestment] = useState<CorporateInvestmentProfile>(initialInvestmentForm);
  const [source, setSource] = useState<CorporateSourceOfFunds>(initialSourceForm);
  const [bank, setBank] = useState<BankForm>(initialBankForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [account, setAccount] = useState<CorporateApplicationDiscoveryItem | null>(null);
  const [profile, setProfile] = useState<CorporateProfileView | null>(null);
  const [savedStatuses, setSavedStatuses] = useState<SavedStatuses>(notStartedStatuses);
  const [saving, setSaving] = useState(false);
  const activeUserId = useRef<string | null>(null);
  const loadEpoch = useRef(0);

  function resetForms() {
    setActiveStep(0);
    setShowDocuments(false);
    setDocumentStatus(null);
    setCompletedSections(new Set());
    setCompany(initialCompanyForm);
    setInvestment(initialInvestmentForm);
    setSource(initialSourceForm);
    setBank(initialBankForm);
    setFieldErrors({});
    setNotice(null);
    setNoticeIsError(false);
    setProfile(null);
    setAccount(null);
    setSavedStatuses(notStartedStatuses);
  }

  /** Replaces every form value with the authoritative persisted projection. */
  function applyProfile(next: CorporateProfileView, step?: number) {
    setProfile(next);
    setSavedStatuses({ ...next.sectionStatuses });
    setCompletedSections(completedFrom(next));
    setCompany(companyFormFrom(next));
    setInvestment(investmentFormFrom(next));
    setSource(sourceFormFrom(next));
    setBank(bankFormFrom(next));
    setActiveStep(step ?? initialStepFor(next));
  }

  async function loadProfile(ownerId: string, options: { keepNotice?: boolean } = {}) {
    const epoch = loadEpoch.current + 1;
    loadEpoch.current = epoch;
    const isCurrent = () => loadEpoch.current === epoch && activeUserId.current === ownerId;
    setLoadState("loading");
    setLoadError(null);
    if (!options.keepNotice) { setNotice(null); setNoticeIsError(false); }
    setFieldErrors({});
    try {
      const accounts = await getMyCorporateApplications();
      if (!isCurrent()) return null;
      // Discovery is ordered most-recently-updated first. No account is ever inferred.
      // A just-created O2 account ID (memory-only handoff) is used only to pick
      // the matching owner-scoped discovery entry; it never bypasses discovery.
      const createdAccountId = getCreatedCorporateAccountId(ownerId);
      const created = createdAccountId ? accounts.find((item) => item.corporateAccountId === createdAccountId) ?? null : null;
      if (createdAccountId && !created) {
        setProfile(null);
        setAccount(null);
        setLoadState("error");
        setLoadError("Your Corporate application was created, but Starfetch has not returned it for this account yet. Retry in a moment. Do not start another application.");
        return null;
      }
      const selected = created ?? accounts[0] ?? null;
      setAccount(selected);
      if (!selected) {
        setProfile(null);
        setLoadState("empty");
        return null;
      }
      const loaded = await getCorporateProfile(selected.corporateAccountId);
      if (!isCurrent()) return null;
      applyProfile(loaded);
      setLoadState("ready");
      return loaded;
    } catch (error) {
      if (!isCurrent()) return null;
      setProfile(null);
      setLoadState("error");
      setLoadError(user ? describeLoadError(error, user) : "We could not load your Corporate Profile. Please try again.");
      return null;
    }
  }

  // Changing users resets every field and discards responses for the previous
  // user. No profile value, TIN or account number is written to browser storage.
  useEffect(() => {
    activeUserId.current = authStatus === "authenticated" && user ? user.id : null;
    loadEpoch.current += 1;
    resetForms();
    setSaving(false);
    setLoadError(null);
    setLoadState("loading");
    if (authStatus === "authenticated" && user) void loadProfile(user.id);
  }, [authStatus, user?.id]);

  function invalidateFrom(index: number) {
    setCompletedSections((current) => {
      const next = new Set(current);
      sections.slice(index).forEach((section) => next.delete(section.key));
      return next;
    });
    setFieldErrors({});
    setNotice(null);
    setNoticeIsError(false);
  }

  function visitSection(index: number) {
    if (index > furthestUnlockedSection(completedSections)) return;
    setShowDocuments(false);
    setActiveStep(index);
    setFieldErrors({});
    setNotice(null);
    setNoticeIsError(false);
  }

  async function saveSection() {
    if (saving || !profile || !account || !user) return;
    const ownerId = user.id;
    const errors = validateSection(activeStep, company, investment, source, bank, Boolean(profile.bankDetails.accountNumberMasked));
    setFieldErrors(errors);
    setNotice(null);
    setNoticeIsError(false);
    if (Object.keys(errors).length) {
      setNotice("Complete the highlighted fields to continue. Nothing has been saved yet.");
      setNoticeIsError(true);
      return;
    }
    const section = sections[activeStep];
    const tinEntered = Boolean(company.taxIdentificationNumber.trim());
    setSaving(true);
    try {
      let saved: CorporateProfileView;
      if (section.key === "companyDetails") {
        saved = await saveCorporateProfileCompanyDetails(account.corporateAccountId, { profileVersion: profile.profileVersion, detailsVersion: profile.detailsVersion }, {
          rcNumber: company.rcNumber.trim(),
          dateOfIncorporation: company.dateOfIncorporation,
          ...(tinEntered ? { taxIdentificationNumber: company.taxIdentificationNumber.trim() } : {}),
          registeredAddress: company.registeredAddress.trim(),
          city: company.city.trim(),
          state: company.state.trim(),
        });
      } else if (section.key === "investmentProfile") {
        saved = await saveCorporateProfileInvestmentProfile(account.corporateAccountId, profile.profileVersion, {
          primaryObjective: investment.primaryObjective,
          riskTolerance: investment.riskTolerance,
          investmentHorizon: investment.investmentHorizon,
          expectedWithdrawals: investment.expectedWithdrawals.trim(),
          withdrawalFrequency: investment.withdrawalFrequency.trim(),
          restrictionsOrExclusions: investment.restrictionsOrExclusions.trim(),
        });
      } else if (section.key === "sourceOfFunds") {
        saved = await saveCorporateProfileSourceOfFunds(account.corporateAccountId, profile.profileVersion, {
          selectedSources: source.selectedSources,
          otherSource: source.otherSource.trim(),
          expectedAnnualInflow: normaliseAnnualInflow(source.expectedAnnualInflow),
          expectedTransactionFrequency: source.expectedTransactionFrequency.trim(),
        });
      } else {
        if (bank.bvnLinkedToAccount === null) return;
        saved = await saveCorporateProfileBankDetails(account.corporateAccountId, profile.profileVersion, {
          bankName: bank.bankName.trim(),
          accountNumber: bank.accountNumber.trim(),
          accountName: bank.accountName.trim(),
          accountType: bank.accountType.trim(),
          bvnLinkedToAccount: bank.bvnLinkedToAccount,
        });
      }
      if (activeUserId.current !== ownerId) return;
      // The PATCH response is the backend's freshly re-read persisted projection.
      const sectionComplete = saved.sectionStatuses[section.key] === "COMPLETE";
      const nextStep = sectionComplete && activeStep < sections.length - 1 ? activeStep + 1 : activeStep;
      applyProfile(saved, Math.min(nextStep, furthestUnlockedSection(completedFrom(saved))));
      if (section.key === "bankDetails" && sectionComplete) setShowDocuments(true);
      setFieldErrors({});
      if (!sectionComplete) {
        setNotice(section.key === "companyDetails"
          ? "Company details were saved as a draft but are not complete. Starfetch needs a company TIN on file to complete this section; enter the TIN and save again."
          : `${section.shortTitle} was saved but is not yet complete. Review the section and save again.`);
        setNoticeIsError(true);
      } else if (saved.progress.percentage === 100) {
        setNotice("All four sections are saved to your Corporate application. This is saved-form completion only and does not represent Corporate verification or approval.");
      } else {
        setNotice(`${section.shortTitle} saved to your Corporate application.`);
      }
    } catch (error) {
      if (activeUserId.current !== ownerId) return;
      // Sensitive write-only values are cleared after any rejected attempt.
      setCompany((current) => ({ ...current, taxIdentificationNumber: "" }));
      setBank((current) => ({ ...current, accountNumber: "" }));
      if (isApiError(error) && error.code === "CONFLICT") {
        const reloaded = await loadProfile(ownerId, { keepNotice: true });
        if (activeUserId.current !== ownerId) return;
        setNotice(`Your Corporate Profile changed since it was loaded, the save order was not met, or the application can no longer be edited. Nothing was saved. The latest saved information has been reloaded — review it before saving again.${errorReference(error)}`);
        setNoticeIsError(true);
        if (reloaded) setActiveStep(Math.min(activeStep, furthestUnlockedSection(completedFrom(reloaded))));
        return;
      }
      setFieldErrors(backendFieldErrors(error));
      setNotice(describeSaveError(error, section.key, tinEntered));
      setNoticeIsError(true);
    } finally {
      if (activeUserId.current === ownerId) setSaving(false);
    }
  }

  async function completeIdentity(input: { companyName: string; companyPhoneNumber: string }): Promise<string | null> {
    if (!user) return "Sign in again to continue.";
    const ownerId = user.id;
    try {
      await completeCorporateApplicantIdentity(input);
      if (activeUserId.current !== ownerId) return null;
      await loadProfile(ownerId);
      void refreshSession();
      return null;
    } catch (error) {
      if (isApiError(error) && error.code === "CONFLICT") {
        await loadProfile(ownerId);
        return `Company identity is already recorded for this account. The latest saved information has been reloaded.${errorReference(error)}`;
      }
      if (isApiError(error) && error.code === "VALIDATION_FAILED") return `Enter the company name and a valid company phone number.${errorReference(error)}`;
      if (isApiError(error) && error.code === "FORBIDDEN") return `Starfetch did not authorise company identity completion for this account. Nothing was saved.${errorReference(error)}`;
      if (isApiError(error) && error.code === "RATE_LIMITED") return `Too many attempts were made.${retryAfterText(error)} Nothing was saved.${errorReference(error)}`;
      return `We could not save the company identity. Nothing was saved.${errorReference(error)}`;
    }
  }

  if (authStatus === "loading") return <main className="grid min-h-[45vh] place-items-center" aria-busy="true"><p className="text-sm font-semibold text-star-muted">Preparing your Corporate Profile form…</p></main>;
  if (authStatus !== "authenticated" || !user) return <main className="min-w-0" aria-labelledby="corporate-profile-heading"><header className="mb-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate account</p><h1 id="corporate-profile-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Company profile</h1></header><section className="rounded-xl border border-star-200 bg-white p-6" role="status"><div className="flex items-start gap-3"><ShieldCheck size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><div><h2 className="text-base font-extrabold text-star-900">Sign in to view the Corporate Profile form</h2><p className="mt-1 text-sm leading-6 text-star-muted">The Corporate Profile is available to an authenticated Corporate applicant.</p></div></div></section></main>;

  const pageHeader = <header className="mb-5"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate account</p><h1 id="corporate-profile-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Company profile</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-star-muted">Complete the four profile sections, then upload the three mandatory documents in Section 5. Each section is saved to your Starfetch Corporate application when you continue, and your saved information is restored when you return.</p></header>;

  if (loadState === "loading") return <main className="min-w-0" aria-labelledby="corporate-profile-heading">{pageHeader}<section className="grid min-h-56 place-items-center rounded-xl border border-star-200 bg-white" aria-busy="true"><div className="text-center"><LoaderCircle size={28} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-star-muted">Loading your saved Corporate Profile…</p></div></section></main>;
  if (loadState === "error") return <main className="min-w-0" aria-labelledby="corporate-profile-heading">{pageHeader}<section className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert"><div className="flex gap-3"><AlertCircle size={21} className="shrink-0 text-red-700" aria-hidden="true" /><div><h2 className="text-base font-extrabold text-star-900">Corporate Profile could not be loaded</h2><p className="mt-1 text-sm leading-6 text-red-700">{loadError}</p><p className="mt-1 text-xs leading-5 text-star-muted">No saved information is shown and nothing has been saved from this page.</p><button type="button" onClick={() => { void loadProfile(user.id); }} className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3"><RefreshCw size={15} aria-hidden="true" />Retry</button></div></div></section></main>;
  if (loadState === "empty" || !profile || !account) return <main className="min-w-0" aria-labelledby="corporate-profile-heading">{pageHeader}<section className="rounded-xl border border-star-200 bg-white p-6 text-center shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><ShieldAlert size={26} className="mx-auto text-star-700" aria-hidden="true" /><p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Corporate Profile</p><h2 className="mt-2 text-lg font-extrabold text-star-900">No Corporate application is available yet</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-star-muted">The Corporate Profile is saved against an existing Corporate application. Starfetch returned no Corporate application for this signed-in account, so there is no profile to load or save.</p><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted">No information has been saved from this page.</p><Link href="/corporate/applications/new" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Start Corporate application<ArrowRight size={16} aria-hidden="true" /></Link></section></main>;

  const currentSection = sections[activeStep];
  const furthest = furthestUnlockedSection(completedSections);
  const allComplete = sections.every((section) => savedStatuses[section.key] === "COMPLETE");
  const applicant = applicantInfo(user, profile);
  const editable = isCorporateDraftEditable(account.status);
  const lifecycle = getCorporateApplicationDisplay(account.status);
  const canCompleteIdentity = (!applicant.companyName || !applicant.companyPhoneNumber) && !profile.applicant.companyName && !profile.applicant.companyPhoneNumber && user.primaryAccountType !== "INDIVIDUAL" && user.primaryAccountType !== null;
  const currentSavedStatus = savedStatuses[currentSection.key];
  const currentStatusLabel = completedSections.has(currentSection.key) ? "Complete · saved" : currentSavedStatus === "COMPLETE" ? "Saved · unsaved edits" : currentSavedStatus === "DRAFT" ? "Saved as draft · not complete" : "Not complete";

  return (
    <main className="min-w-0" aria-labelledby="corporate-profile-heading">
      {pageHeader}

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#f2d89d] bg-[#fff9e8] p-4" role="note"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><p className="text-sm leading-6 text-star-muted"><span className="font-extrabold text-star-900">{editable ? `${profile.progress.percentage}% of sections saved.` : "Editing unavailable."}</span> {editable ? "Saving a section records your answers only. It does not submit, verify, or approve your Corporate application." : `This application is in the “${lifecycle.label}” state, so Starfetch does not allow Corporate Profile changes. Saved information is shown for review only.`}</p></div>

      {allComplete ? <p className="mb-5 rounded-lg border border-[#bfe8ca] bg-[#effbf2] px-4 py-3 text-sm leading-6 text-star-800" role="status"><span className="font-extrabold">All four sections are saved.</span> This is saved-form completion only. It does not represent KYC/KYB verification, approval, or investment authorisation.</p> : null}

      <nav aria-label="Corporate Profile sections" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {sections.map((section, index) => {
          const isComplete = completedSections.has(section.key);
          const disabled = index > furthest;
          const active = !showDocuments && index === activeStep;
          return <button key={section.key} type="button" onClick={() => visitSection(index)} disabled={disabled} aria-current={active ? "step" : undefined} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${active ? "border-star-700 bg-star-50 shadow-sm" : isComplete ? "border-[#bfe8ca] bg-white hover:bg-[#f7fcf8]" : "border-star-200 bg-white hover:bg-star-50"}`}>
            <span className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold uppercase tracking-[0.11em] text-star-700">Section {index + 1}</span>{isComplete ? <CheckCircle2 size={17} className="text-[#16743d]" aria-label="Complete and saved" /> : <Circle size={17} className="text-star-300" aria-hidden="true" />}</span>
            <span className="mt-2 block text-sm font-extrabold text-star-900">{section.shortTitle}</span>
            <span className="mt-1 block text-xs font-semibold text-star-muted">{isComplete ? "Complete · saved" : active ? "Current section" : disabled ? "Locked until previous section is complete" : savedStatuses[section.key] === "DRAFT" ? "Saved as draft" : "Not complete"}</span>
          </button>;
        })}
        <button type="button"
          onClick={() => { setShowDocuments(true); setNotice(null); }}
          aria-current={showDocuments ? "step" : undefined}
          className={`rounded-xl border p-4 text-left transition ${showDocuments ? "border-star-700 bg-star-50 shadow-sm" : "border-star-200 bg-white hover:bg-star-50"}`}>
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold uppercase tracking-[0.11em] text-star-700">Section 5</span>
            {documentStatus === "COMPLETE" ? <CheckCircle2 size={17} className="text-[#16743d]" /> : <Circle size={17} className="text-star-300" />}
          </span>
          <span className="mt-2 block text-sm font-extrabold text-star-900">KYC documents</span>
          <span className="mt-1 block text-xs font-semibold text-star-muted">
            {documentStatus === "COMPLETE" ? "Documents uploaded" : documentStatus === "DRAFT" ? "In progress" : "Upload required documents"}
          </span>
        </button>
      </nav>

      {!showDocuments && (
      <section className="mt-5 rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="corporate-profile-step-heading">
        <div className="border-b border-star-100 px-5 py-5 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Section {activeStep + 1} of 5 · {currentStatusLabel}</p>
          <h2 id="corporate-profile-step-heading" className="mt-2 text-xl font-extrabold tracking-[-0.025em] text-star-900">{currentSection.title}</h2>
          <p className="mt-2 text-sm leading-6 text-star-muted">{currentSection.description}</p>
        </div>

        <form noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void saveSection(); }} className="p-5 sm:p-6" aria-busy={saving}>
          <fieldset disabled={!editable} className="m-0 min-w-0 border-0 p-0">
          {activeStep === 0 ? <CompanyDetailsSection applicant={applicant} values={company} errors={fieldErrors} tinMasked={profile.canonicalDetails.taxIdentificationNumberMasked} companyStatus={savedStatuses.companyDetails} canCompleteIdentity={canCompleteIdentity} onCompleteIdentity={completeIdentity} onChange={(name, value) => { setCompany((current) => ({ ...current, [name]: value })); invalidateFrom(0); }} /> : null}
          {activeStep === 1 ? <InvestmentSection values={investment} errors={fieldErrors} onChange={(name, value) => { setInvestment((current) => ({ ...current, [name]: value })); invalidateFrom(1); }} /> : null}
          {activeStep === 2 ? <SourceOfFundsSection values={source} errors={fieldErrors} onTextChange={(name, value) => { setSource((current) => ({ ...current, [name]: value })); invalidateFrom(2); }} onToggleSource={(option, checked) => { setSource((current) => ({ ...current, selectedSources: checked ? [...current.selectedSources, option] : current.selectedSources.filter((item) => item !== option), ...(option === "Other (specify)" && !checked ? { otherSource: "" } : {}) })); invalidateFrom(2); }} /> : null}
          {activeStep === 3 ? <BankDetailsSection values={bank} errors={fieldErrors} accountNumberMasked={profile.bankDetails.accountNumberMasked} onTextChange={(name, value) => { setBank((current) => ({ ...current, [name]: value })); invalidateFrom(3); }} onBvnChange={(value) => { setBank((current) => ({ ...current, bvnLinkedToAccount: value })); invalidateFrom(3); }} /> : null}

          </fieldset>

          {notice ? <p role={noticeIsError ? "alert" : "status"} className={`mt-5 rounded-lg border px-4 py-3 text-sm leading-6 ${noticeIsError ? "border-red-200 bg-red-50 text-red-700" : "border-[#bfe8ca] bg-[#effbf2] text-star-800"}`}>{notice}</p> : null}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {activeStep > 0 ? <button type="button" onClick={() => visitSection(activeStep - 1)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50"><ArrowLeft size={16} aria-hidden="true" />Previous section</button> : <span />}
            <button type="submit" disabled={saving || !editable} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Saving…</> : !editable ? "Editing unavailable" : activeStep === sections.length - 1 ? <>Save bank details<CheckCircle2 size={16} aria-hidden="true" /></> : <>Save & continue<ArrowRight size={16} aria-hidden="true" /> </>}</button>
          </div>
        </form>
      </section>
      )}
      {showDocuments && (
        <section className="mt-5 rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="corporate-documents-heading">
          <div className="border-b border-star-100 px-5 py-5 sm:px-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Section 5 of 5</p>
            <h2 id="corporate-documents-heading" className="mt-2 text-xl font-extrabold text-star-900">Corporate KYC Documents</h2>
            <p className="mt-2 text-sm leading-6 text-star-muted">Upload the three mandatory company documents before submitting your application for review.</p>
          </div>
          <CorporateDocumentUploadSection
            accountId={account.corporateAccountId}
            onBack={() => { setShowDocuments(false); setActiveStep(furthest); }}
            onStatusChange={setDocumentStatus}
          onSubmitted={(status) => {
            setAccount((current) =>
              current?.corporateAccountId === account.corporateAccountId
                ? { ...current, status }
                : current
            );
          }}
          />
        </section>
      )}

      <p className="mt-4 text-xs leading-5 text-star-muted">Company name, company phone and account email are read-only account identity returned by Starfetch. Saved sections are restored from Starfetch when you return or sign in again. The TIN and bank account number are never displayed in full; only masked values returned by Starfetch are shown, and they are never stored in this browser.</p>
    </main>
  );
}

function CompanyDetailsSection({ applicant, values, errors, tinMasked, companyStatus, canCompleteIdentity, onCompleteIdentity, onChange }: { applicant: CorporateApplicantInfo; values: CompanyForm; errors: FieldErrors; tinMasked: string | null; companyStatus: CorporateProfileSectionStatus; canCompleteIdentity: boolean; onCompleteIdentity: (input: { companyName: string; companyPhoneNumber: string }) => Promise<string | null>; onChange: (name: string, value: string) => void }) {
  const tinHelp = tinMasked
    ? `TIN on file: ${tinMasked}. Leave blank to keep it; enter a new TIN only to replace it.`
    : companyStatus === "COMPLETE"
      ? "A TIN is on file but is not displayed. Leave blank to keep it; enter a new TIN only to replace it."
      : "Enter the company TIN. If a TIN is already on file it is not displayed; leaving this blank keeps it.";
  return <div className="space-y-6">
    <section className="rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="corporate-applicant-information-heading">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-star-700"><Building2 size={18} aria-hidden="true" /></span><div><h3 id="corporate-applicant-information-heading" className="text-base font-extrabold text-star-900">Corporate applicant information</h3><p className="mt-1 text-sm leading-6 text-star-muted">These account identity values are read-only and cannot be edited here.</p></div></div>
      <dl className="mt-4 grid gap-4 border-t border-star-200 pt-4 sm:grid-cols-3">
        <ReadOnlyValue label="Company name" value={applicant.companyName} />
        <ReadOnlyValue label="Company phone number" value={applicant.companyPhoneNumber} />
        <ReadOnlyValue label="Account email" value={applicant.email} />
      </dl>
      {!applicant.companyName || !applicant.companyPhoneNumber ? <p className="mt-3 rounded-lg border border-[#f2d89d] bg-white px-3 py-2 text-xs leading-5 text-star-muted">Company name or phone has not been recorded for this Corporate applicant account.{canCompleteIdentity ? " You can record them once below." : ""}</p> : null}
      {canCompleteIdentity ? <LegacyIdentityForm onSubmit={onCompleteIdentity} /> : null}
    </section>
    <section aria-labelledby="corporate-registered-details-heading">
      <h3 id="corporate-registered-details-heading" className="text-base font-extrabold text-star-900">Registered company details</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="RC number" name="rcNumber" value={values.rcNumber} required error={errors.rcNumber} onChange={onChange} />
        <TextField label="Date of incorporation" name="dateOfIncorporation" type="date" value={values.dateOfIncorporation} required error={errors.dateOfIncorporation} onChange={onChange} />
        <TextField label="TIN number" name="taxIdentificationNumber" value={values.taxIdentificationNumber} required={!tinMasked && companyStatus !== "COMPLETE"} autoComplete="off" help={tinHelp} error={errors.taxIdentificationNumber} onChange={onChange} />
        <TextField label="Registered address" name="registeredAddress" value={values.registeredAddress} required error={errors.registeredAddress} onChange={onChange} className="sm:col-span-2" />
        <TextField label="City" name="city" value={values.city} required error={errors.city} onChange={onChange} />
        <TextField label="State" name="state" value={values.state} required error={errors.state} onChange={onChange} />
      </div>
    </section>
  </div>;
}

/** One-time completion of absent legacy company display identity (PATCH /me/corporate-applicant-profile). */
function LegacyIdentityForm({ onSubmit }: { onSubmit: (input: { companyName: string; companyPhoneNumber: string }) => Promise<string | null> }) {
  const [values, setValues] = useState({ companyName: "", companyPhoneNumber: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    const nextErrors: FieldErrors = {};
    const name = values.companyName.trim();
    const phone = values.companyPhoneNumber.trim();
    if (!name || name.length > 160) nextErrors.companyName = "Enter the company name (160 characters or fewer).";
    if (phone.length < 7 || phone.length > 32 || !corporateApplicantPhonePattern.test(phone)) nextErrors.companyPhoneNumber = "Enter a valid company phone number, e.g. +2348000000000.";
    setErrors(nextErrors);
    setMessage(null);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    const failure = await onSubmit({ companyName: name, companyPhoneNumber: phone });
    setSubmitting(false);
    if (failure) setMessage(failure);
  }

  return <div className="mt-4 grid gap-4 border-t border-star-200 pt-4 sm:grid-cols-2">
    <TextField label="Company name" name="legacyCompanyName" value={values.companyName} required error={errors.companyName} onChange={(_name, value) => setValues((current) => ({ ...current, companyName: value }))} />
    <TextField label="Company phone number" name="legacyCompanyPhoneNumber" value={values.companyPhoneNumber} required autoComplete="tel" error={errors.companyPhoneNumber} onChange={(_name, value) => setValues((current) => ({ ...current, companyPhoneNumber: value }))} />
    <div className="sm:col-span-2">
      <button type="button" onClick={() => { void submit(); }} disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Saving…</> : "Save company identity"}</button>
      {message ? <p role="alert" className="mt-3 text-xs font-medium leading-5 text-red-700">{message}</p> : null}
    </div>
  </div>;
}

function InvestmentSection({ values, errors, onChange }: { values: CorporateInvestmentProfile; errors: FieldErrors; onChange: (name: string, value: string) => void }) {
  return <div className="space-y-6">
    <RadioGroup label="Primary investment objective" name="primaryObjective" options={corporateInvestmentObjectives} value={values.primaryObjective} onChange={onChange} error={errors.primaryObjective} />
    <RadioGroup label="Risk tolerance" name="riskTolerance" options={corporateRiskToleranceOptions} value={values.riskTolerance} onChange={onChange} error={errors.riskTolerance} />
    <RadioGroup label="Investment horizon" name="investmentHorizon" options={corporateInvestmentHorizonOptions} value={values.investmentHorizon} onChange={onChange} error={errors.investmentHorizon} />
    <section aria-labelledby="corporate-liquidity-heading">
      <h3 id="corporate-liquidity-heading" className="text-sm font-extrabold text-star-900">Liquidity requirements / withdrawal expectations</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <TextField label="Expected withdrawals" name="expectedWithdrawals" value={values.expectedWithdrawals} required placeholder="e.g. ₦500,000 or No withdrawals planned" error={errors.expectedWithdrawals} onChange={onChange} />
        <TextField label="Frequency" name="withdrawalFrequency" value={values.withdrawalFrequency} required placeholder="e.g. Monthly, quarterly, as needed" error={errors.withdrawalFrequency} onChange={onChange} />
      </div>
    </section>
    <TextField label="Investment restrictions or exclusions (if any)" name="restrictionsOrExclusions" value={values.restrictionsOrExclusions} multiline placeholder="Optional" onChange={onChange} />
  </div>;
}

function SourceOfFundsSection({ values, errors, onTextChange, onToggleSource }: { values: CorporateSourceOfFunds; errors: FieldErrors; onTextChange: (name: string, value: string) => void; onToggleSource: (option: string, checked: boolean) => void }) {
  return <div className="space-y-6">
    <fieldset>
      <legend className="text-sm font-extrabold text-star-900">Source of funds to be invested <span className="text-star-700" aria-hidden="true">*</span></legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {corporateSourceOfFundsOptions.map((option) => <label key={option} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-star-200 bg-white px-3.5 text-sm font-semibold text-star-800 hover:bg-star-50"><input type="checkbox" checked={values.selectedSources.includes(option)} onChange={(event) => onToggleSource(option, event.target.checked)} className="size-4 rounded border-star-300 text-star-700 focus:ring-2 focus:ring-star-700" />{option}</label>)}
      </div>
      {errors.selectedSources ? <p className="mt-2 text-xs font-medium text-red-700" role="alert">{errors.selectedSources}</p> : null}
    </fieldset>
    {values.selectedSources.includes("Other (specify)") ? <TextField label="If other, specify" name="otherSource" value={values.otherSource} required error={errors.otherSource} onChange={onTextChange} /> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Expected annual inflow (₦)" name="expectedAnnualInflow" value={values.expectedAnnualInflow} required inputMode="decimal" error={errors.expectedAnnualInflow} onChange={onTextChange} />
      <TextField label="Expected transaction frequency" name="expectedTransactionFrequency" value={values.expectedTransactionFrequency} required placeholder="e.g. Monthly or quarterly" error={errors.expectedTransactionFrequency} onChange={onTextChange} />
    </div>
  </div>;
}

function BankDetailsSection({ values, errors, accountNumberMasked, onTextChange, onBvnChange }: { values: BankForm; errors: FieldErrors; accountNumberMasked: string | null; onTextChange: (name: string, value: string) => void; onBvnChange: (value: boolean) => void }) {
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Bank name" name="bankName" value={values.bankName} required error={errors.bankName} onChange={onTextChange} />
      <TextField label="Account number (NUBAN)" name="accountNumber" value={values.accountNumber} required inputMode="numeric" autoComplete="off" help={accountNumberMasked ? `Account on file: ${accountNumberMasked}. For security the full number is never shown; re-enter the full 10-digit NUBAN to save bank details.` : "Enter a 10-digit NUBAN account number."} error={errors.accountNumber} onChange={onTextChange} />
      <TextField label="Account name" name="accountName" value={values.accountName} required error={errors.accountName} onChange={onTextChange} />
      <TextField label="Account type" name="accountType" value={values.accountType} required placeholder="e.g. Current or Savings" error={errors.accountType} onChange={onTextChange} />
    </div>
    <fieldset>
      <legend className="text-sm font-extrabold text-star-900">BVN linked to this account? <span className="text-star-700" aria-hidden="true">*</span></legend>
      <div className="mt-3 flex flex-wrap gap-3">
        {[{ label: "Yes", value: true }, { label: "No", value: false }].map((option) => <label key={option.label} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-semibold text-star-800 hover:bg-star-50"><input type="radio" name="bvnLinkedToAccount" checked={values.bvnLinkedToAccount === option.value} onChange={() => onBvnChange(option.value)} className="size-4 border-star-300 text-star-700 focus:ring-2 focus:ring-star-700" />{option.label}</label>)}
      </div>
      {errors.bvnLinkedToAccount ? <p className="mt-2 text-xs font-medium text-red-700" role="alert">{errors.bvnLinkedToAccount}</p> : null}
    </fieldset>
  </div>;
}

function TextField({ label, name, value, onChange, required = false, type = "text", placeholder, help, error, className = "", autoComplete, inputMode, multiline = false }: { label: string; name: string; value: string; onChange: (name: string, value: string) => void; required?: boolean; type?: "text" | "date"; placeholder?: string; help?: string; error?: string; className?: string; autoComplete?: string; inputMode?: "numeric" | "decimal"; multiline?: boolean }) {
  const id = `corporate-profile-${name}`;
  const common = `w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`;
  return <div className={className}>
    <label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label}{required ? <span className="ml-1 text-star-700" aria-hidden="true">*</span> : null}</label>
    {multiline ? <textarea id={id} name={name} rows={3} value={value} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} aria-describedby={[help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} className={`${common} min-h-24 py-3`} /> : <input id={id} name={name} type={type} inputMode={inputMode} autoComplete={autoComplete} value={value} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} required={required} aria-invalid={Boolean(error)} aria-describedby={[help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined} className={`${common} h-12`} />}
    {help ? <p id={`${id}-help`} className="mt-2 text-xs leading-5 text-star-muted">{help}</p> : null}
    {error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
  </div>;
}

function RadioGroup({ label, name, options, value, onChange, error }: { label: string; name: keyof CorporateInvestmentProfile; options: readonly string[]; value: string; onChange: (name: string, value: string) => void; error?: string }) {
  return <fieldset>
    <legend className="text-sm font-extrabold text-star-900">{label} <span className="text-star-700" aria-hidden="true">*</span></legend>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {options.map((option) => <label key={option} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-star-200 bg-white px-3.5 text-sm font-semibold text-star-800 hover:bg-star-50"><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(name, option)} className="size-4 border-star-300 text-star-700 focus:ring-2 focus:ring-star-700" />{option}</label>)}
    </div>
    {error ? <p className="mt-2 text-xs font-medium text-red-700" role="alert">{error}</p> : null}
  </fieldset>;
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">{label}</dt><dd className="mt-1.5 break-words text-sm font-semibold text-star-800">{value || "Not recorded for this account"}</dd></div>;
}
