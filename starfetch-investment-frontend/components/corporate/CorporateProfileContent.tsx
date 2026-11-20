"use client";

import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CorporateDocumentUploadSection } from "./CorporateDocumentUploadSection";
import {
  corporateInvestmentHorizonOptions,
  corporateInvestmentObjectives,
  corporateRiskToleranceOptions,
  corporateSourceOfFundsOptions,
  emptyCorporateBankDetails,
  emptyCorporateCompanyDetails,
  emptyCorporateInvestmentProfile,
  emptyCorporateSourceOfFunds,
  type CorporateApplicantInfo,
  type CorporateBankDetails,
  type CorporateCompanyDetails,
  type CorporateInvestmentProfile,
  type CorporateSourceOfFunds,
} from "@/lib/corporate/profile";

type SectionKey = "companyDetails" | "investmentProfile" | "sourceOfFunds" | "bankDetails";
type FieldErrors = Record<string, string>;
type CompanyForm = CorporateCompanyDetails;
type BankForm = CorporateBankDetails;
type SectionDefinition = { key: SectionKey; title: string; shortTitle: string; description: string };

const sections: SectionDefinition[] = [
  { key: "companyDetails", title: "Corporate Applicant Information & Company Details", shortTitle: "Company details", description: "Review the read-only account information and complete the registered-company details." },
  { key: "investmentProfile", title: "Investment Objective & Risk Profile", shortTitle: "Investment profile", description: "Enter the company’s investment objectives, risk tolerance, horizon, and liquidity expectations." },
  { key: "sourceOfFunds", title: "Source of Funds and Wealth", shortTitle: "Source of funds", description: "Select the source or sources of funds and enter the expected inflow and transaction frequency." },
  { key: "bankDetails", title: "Bank Details", shortTitle: "Bank details", description: "Enter the bank account details for the company’s distributions." },
];

/** Section 5 (document upload) is backend-backed and follows the four local-only sections. */
const DOCUMENT_STEP_INDEX = sections.length;
const documentSection = { title: "Corporate Document Upload", description: "Upload the three mandatory Corporate KYC documents. Uploaded documents are saved to your application and shown when you return." };

const initialCompanyForm: CompanyForm = emptyCorporateCompanyDetails();
const initialInvestmentForm: CorporateInvestmentProfile = emptyCorporateInvestmentProfile();
const initialSourceForm: CorporateSourceOfFunds = emptyCorporateSourceOfFunds();
const initialBankForm: BankForm = emptyCorporateBankDetails();

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

function validateSection(index: number, company: CompanyForm, investment: CorporateInvestmentProfile, source: CorporateSourceOfFunds, bank: BankForm): FieldErrors {
  const errors: FieldErrors = {};
  const required = (name: string, value: string, label: string) => { if (!value.trim()) errors[name] = `Enter ${label}.`; };

  if (index === 0) {
    required("rcNumber", company.rcNumber, "the RC number");
    if (!company.dateOfIncorporation) errors.dateOfIncorporation = "Select the date of incorporation.";
    else if (!dateIsValidAndNotFuture(company.dateOfIncorporation)) errors.dateOfIncorporation = "Enter a valid incorporation date that is not in the future.";
    required("taxIdentificationNumber", company.taxIdentificationNumber, "the TIN number");
    required("registeredAddress", company.registeredAddress, "the registered address");
    required("city", company.city, "the city");
    required("state", company.state, "the state");
  } else if (index === 1) {
    if (!(corporateInvestmentObjectives as readonly string[]).includes(investment.primaryObjective)) errors.primaryObjective = "Select a primary investment objective.";
    if (!(corporateRiskToleranceOptions as readonly string[]).includes(investment.riskTolerance)) errors.riskTolerance = "Select a risk-tolerance level.";
    if (!(corporateInvestmentHorizonOptions as readonly string[]).includes(investment.investmentHorizon)) errors.investmentHorizon = "Select an investment horizon.";
    required("expectedWithdrawals", investment.expectedWithdrawals, "expected withdrawals or enter ‘No withdrawals planned’");
    required("withdrawalFrequency", investment.withdrawalFrequency, "the withdrawal frequency");
  } else if (index === 2) {
    if (!source.selectedSources.length) errors.selectedSources = "Select at least one source of funds.";
    if (source.selectedSources.includes("Other (specify)") && !source.otherSource.trim()) errors.otherSource = "Describe the other source of funds.";
    required("expectedAnnualInflow", source.expectedAnnualInflow, "the expected annual inflow");
    required("expectedTransactionFrequency", source.expectedTransactionFrequency, "the expected transaction frequency");
  } else {
    required("bankName", bank.bankName, "the bank name");
    if (!/^\d{10}$/.test(bank.accountNumber.trim())) errors.accountNumber = "Enter a valid 10-digit NUBAN account number.";
    required("accountName", bank.accountName, "the account name");
    required("accountType", bank.accountType, "the account type");
    if (bank.bvnLinkedToAccount === null) errors.bvnLinkedToAccount = "Select Yes or No.";
  }
  return errors;
}

function applicantInfo(user: { email: string; companyName?: string; companyPhoneNumber?: string }): CorporateApplicantInfo {
  return {
    companyName: user.companyName?.trim() ?? "",
    companyPhoneNumber: user.companyPhoneNumber?.trim() ?? "",
    email: user.email,
  };
}

export function CorporateProfileContent() {
  const { status: authStatus, user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<SectionKey>>(() => new Set());
  const [company, setCompany] = useState<CompanyForm>(initialCompanyForm);
  const [investment, setInvestment] = useState<CorporateInvestmentProfile>(initialInvestmentForm);
  const [source, setSource] = useState<CorporateSourceOfFunds>(initialSourceForm);
  const [bank, setBank] = useState<BankForm>(initialBankForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [documentsStatus, setDocumentsStatus] = useState<"NOT_STARTED" | "DRAFT" | "COMPLETE" | null>(null);

  // Sections 1–4 are deliberately a page-memory-only form. Changing users
  // resets every field; no profile GET/PUT, localStorage or sessionStorage
  // runs for them. Section 5 (documents) is backend-backed and loads its own
  // saved state.
  useEffect(() => {
    setActiveStep(0);
    setCompletedSections(new Set());
    setCompany(initialCompanyForm);
    setInvestment(initialInvestmentForm);
    setSource(initialSourceForm);
    setBank(initialBankForm);
    setFieldErrors({});
    setNotice(null);
    setDocumentsStatus(null);
  }, [authStatus, user?.id]);

  function invalidateFrom(index: number) {
    setCompletedSections((current) => {
      const next = new Set(current);
      sections.slice(index).forEach((section) => next.delete(section.key));
      return next;
    });
    setFieldErrors({});
    setNotice(null);
  }

  function visitSection(index: number) {
    const localComplete = sections.every((section) => completedSections.has(section.key));
    const maxReachable = localComplete ? DOCUMENT_STEP_INDEX : furthestUnlockedSection(completedSections);
    if (index > maxReachable) return;
    setActiveStep(index);
    setFieldErrors({});
    setNotice(null);
  }

  function continueLocally() {
    const errors = validateSection(activeStep, company, investment, source, bank);
    setFieldErrors(errors);
    setNotice(null);
    if (Object.keys(errors).length) {
      setNotice("Complete the highlighted fields to continue. Your entries remain only in this page session and are not sent or saved.");
      return;
    }
    const currentKey = sections[activeStep].key;
    setCompletedSections((current) => new Set(current).add(currentKey));
    if (activeStep < sections.length - 1) {
      setActiveStep(activeStep + 1);
      setNotice(`${sections[activeStep].shortTitle} completed in this page session only. Nothing was sent or saved to the backend.`);
    } else {
      setNotice("All four sections are complete in this page session only. No information was sent or saved to the backend, and this does not represent Corporate verification or approval.");
    }
  }

  if (authStatus === "loading") return <main className="grid min-h-[45vh] place-items-center" aria-busy="true"><p className="text-sm font-semibold text-star-muted">Preparing your Corporate Profile form…</p></main>;
  if (authStatus !== "authenticated" || !user) return <main className="min-w-0" aria-labelledby="corporate-profile-heading"><header className="mb-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate account</p><h1 id="corporate-profile-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Company profile</h1></header><section className="rounded-xl border border-star-200 bg-white p-6" role="status"><div className="flex items-start gap-3"><ShieldCheck size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><div><h2 className="text-base font-extrabold text-star-900">Sign in to view the Corporate Profile form</h2><p className="mt-1 text-sm leading-6 text-star-muted">The local form is available to an authenticated Corporate applicant.</p></div></div></section></main>;

  const isDocumentStep = activeStep === DOCUMENT_STEP_INDEX;
  const currentSection = isDocumentStep ? documentSection : sections[activeStep];
  const furthest = furthestUnlockedSection(completedSections);
  const allComplete = sections.every((section) => completedSections.has(section.key));
  const applicant = applicantInfo(user);
  const sectionStepStatus = isDocumentStep
    ? documentsStatus === "COMPLETE" ? "Complete · saved to application" : "Not complete"
    : sections[activeStep] && completedSections.has(sections[activeStep].key) ? "Complete in this session" : "Not complete";

  return (
    <main className="min-w-0" aria-labelledby="corporate-profile-heading">
      <header className="mb-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate account</p>
        <h1 id="corporate-profile-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Company profile</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-star-muted">Complete the sections in order. Sections 1–4 are held in this page session only; they are not sent to or saved by the backend and will be cleared when you leave or refresh. Section 5 (document upload) is saved securely to your application and submitted for Starfetch review.</p>
      </header>

      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#f2d89d] bg-[#fff9e8] p-4" role="note"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><p className="text-sm leading-6 text-star-muted"><span className="font-extrabold text-star-900">Sections 1–4 are local-only.</span> That part of the form is for review only and has no save or submit action. Section 5 uploads documents to your application and submits it for Starfetch review.</p></div>

      {allComplete && !isDocumentStep ? <div className="mb-5 rounded-lg border border-[#bfe8ca] bg-[#effbf2] px-4 py-3" role="status"><p className="text-sm leading-6 text-star-800"><span className="font-extrabold">All four sections are complete in this page session.</span> This does not represent a saved Corporate profile, KYC/KYB verification, approval, or investment authorisation.</p><button type="button" onClick={() => visitSection(DOCUMENT_STEP_INDEX)} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Continue to Section 5: Document upload<ArrowRight size={16} aria-hidden="true" /></button></div> : null}

      <nav aria-label="Corporate Profile sections" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {sections.map((section, index) => {
          const isComplete = completedSections.has(section.key);
          const disabled = index > furthest;
          const active = index === activeStep;
          return <button key={section.key} type="button" onClick={() => visitSection(index)} disabled={disabled} aria-current={active ? "step" : undefined} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${active ? "border-star-700 bg-star-50 shadow-sm" : isComplete ? "border-[#bfe8ca] bg-white hover:bg-[#f7fcf8]" : "border-star-200 bg-white hover:bg-star-50"}`}>
            <span className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold uppercase tracking-[0.11em] text-star-700">Section {index + 1}</span>{isComplete ? <CheckCircle2 size={17} className="text-[#16743d]" aria-label="Complete in this session" /> : <Circle size={17} className="text-star-300" aria-hidden="true" />}</span>
            <span className="mt-2 block text-sm font-extrabold text-star-900">{section.shortTitle}</span>
            <span className="mt-1 block text-xs font-semibold text-star-muted">{isComplete ? "Complete · this session only" : active ? "Current section" : "Locked until previous section is complete"}</span>
          </button>;
        })}
        <button type="button" onClick={() => visitSection(DOCUMENT_STEP_INDEX)} disabled={!allComplete} aria-current={isDocumentStep ? "step" : undefined} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${isDocumentStep ? "border-star-700 bg-star-50 shadow-sm" : documentsStatus === "COMPLETE" ? "border-[#bfe8ca] bg-white hover:bg-[#f7fcf8]" : "border-star-200 bg-white hover:bg-star-50"}`}>
          <span className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold uppercase tracking-[0.11em] text-star-700">Section 5</span>{documentsStatus === "COMPLETE" ? <CheckCircle2 size={17} className="text-[#16743d]" aria-label="Documents complete" /> : <Circle size={17} className="text-star-300" aria-hidden="true" />}</span>
          <span className="mt-2 block text-sm font-extrabold text-star-900">Document upload</span>
          <span className="mt-1 block text-xs font-semibold text-star-muted">{documentsStatus === "COMPLETE" ? "Complete · saved to application" : isDocumentStep ? "Current section" : "Locked until previous sections are complete"}</span>
        </button>
      </nav>

      <section className="mt-5 rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="corporate-profile-step-heading">
        <div className="border-b border-star-100 px-5 py-5 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Section {activeStep + 1} of {DOCUMENT_STEP_INDEX + 1} · {sectionStepStatus}</p>
          <h2 id="corporate-profile-step-heading" className="mt-2 text-xl font-extrabold tracking-[-0.025em] text-star-900">{currentSection.title}</h2>
          <p className="mt-2 text-sm leading-6 text-star-muted">{currentSection.description}</p>
        </div>

        {isDocumentStep ? <CorporateDocumentUploadSection onBack={() => visitSection(DOCUMENT_STEP_INDEX - 1)} onStatusChange={setDocumentsStatus} /> : (
        <form noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); continueLocally(); }} className="p-5 sm:p-6">
          {activeStep === 0 ? <CompanyDetailsSection applicant={applicant} values={company} errors={fieldErrors} onChange={(name, value) => { setCompany((current) => ({ ...current, [name]: value })); invalidateFrom(0); }} /> : null}
          {activeStep === 1 ? <InvestmentSection values={investment} errors={fieldErrors} onChange={(name, value) => { setInvestment((current) => ({ ...current, [name]: value })); invalidateFrom(1); }} /> : null}
          {activeStep === 2 ? <SourceOfFundsSection values={source} errors={fieldErrors} onTextChange={(name, value) => { setSource((current) => ({ ...current, [name]: value })); invalidateFrom(2); }} onToggleSource={(option, checked) => { setSource((current) => ({ ...current, selectedSources: checked ? [...current.selectedSources, option] : current.selectedSources.filter((item) => item !== option), ...(option === "Other (specify)" && !checked ? { otherSource: "" } : {}) })); invalidateFrom(2); }} /> : null}
          {activeStep === 3 ? <BankDetailsSection values={bank} errors={fieldErrors} onTextChange={(name, value) => { setBank((current) => ({ ...current, [name]: value })); invalidateFrom(3); }} onBvnChange={(value) => { setBank((current) => ({ ...current, bvnLinkedToAccount: value })); invalidateFrom(3); }} /> : null}

          {notice ? <p role={Object.keys(fieldErrors).length ? "alert" : "status"} className={`mt-5 rounded-lg border px-4 py-3 text-sm leading-6 ${Object.keys(fieldErrors).length ? "border-red-200 bg-red-50 text-red-700" : "border-[#bfe8ca] bg-[#effbf2] text-star-800"}`}>{notice}</p> : null}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {activeStep > 0 ? <button type="button" onClick={() => visitSection(activeStep - 1)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50"><ArrowLeft size={16} aria-hidden="true" />Previous section</button> : <span />}
            <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">{activeStep === sections.length - 1 ? <>Mark complete for this session<CheckCircle2 size={16} aria-hidden="true" /></> : <>Validate & continue<ArrowRight size={16} aria-hidden="true" /> </>}</button>
          </div>
        </form>
        )}
      </section>

      <p className="mt-4 text-xs leading-5 text-star-muted">The company name and phone are displayed read-only only when present in the authenticated account projection. If this older account does not provide them, they appear as unavailable. Form values and section completion are not retained after leaving or refreshing this page. Uploaded documents and submission status are saved to your application and shown when you return.</p>
    </main>
  );
}

function CompanyDetailsSection({ applicant, values, errors, onChange }: { applicant: CorporateApplicantInfo; values: CompanyForm; errors: FieldErrors; onChange: (name: string, value: string) => void }) {
  return <div className="space-y-6">
    <section className="rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="corporate-applicant-information-heading">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-star-700"><Building2 size={18} aria-hidden="true" /></span><div><h3 id="corporate-applicant-information-heading" className="text-base font-extrabold text-star-900">Corporate applicant information</h3><p className="mt-1 text-sm leading-6 text-star-muted">These account identity values are read-only and cannot be edited here.</p></div></div>
      <dl className="mt-4 grid gap-4 border-t border-star-200 pt-4 sm:grid-cols-3">
        <ReadOnlyValue label="Company name" value={applicant.companyName} />
        <ReadOnlyValue label="Company phone number" value={applicant.companyPhoneNumber} />
        <ReadOnlyValue label="Account email" value={applicant.email} />
      </dl>
      {!applicant.companyName || !applicant.companyPhoneNumber ? <p className="mt-3 rounded-lg border border-[#f2d89d] bg-white px-3 py-2 text-xs leading-5 text-star-muted">Company name or phone is not available in this signed-in account session. No profile API is called to retrieve it.</p> : null}
    </section>
    <section aria-labelledby="corporate-registered-details-heading">
      <h3 id="corporate-registered-details-heading" className="text-base font-extrabold text-star-900">Registered company details</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="RC number" name="rcNumber" value={values.rcNumber} required error={errors.rcNumber} onChange={onChange} />
        <TextField label="Date of incorporation" name="dateOfIncorporation" type="date" value={values.dateOfIncorporation} required error={errors.dateOfIncorporation} onChange={onChange} />
        <TextField label="TIN number" name="taxIdentificationNumber" value={values.taxIdentificationNumber} required autoComplete="off" error={errors.taxIdentificationNumber} onChange={onChange} />
        <TextField label="Registered address" name="registeredAddress" value={values.registeredAddress} required error={errors.registeredAddress} onChange={onChange} className="sm:col-span-2" />
        <TextField label="City" name="city" value={values.city} required error={errors.city} onChange={onChange} />
        <TextField label="State" name="state" value={values.state} required error={errors.state} onChange={onChange} />
      </div>
    </section>
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

function BankDetailsSection({ values, errors, onTextChange, onBvnChange }: { values: BankForm; errors: FieldErrors; onTextChange: (name: string, value: string) => void; onBvnChange: (value: boolean) => void }) {
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Bank name" name="bankName" value={values.bankName} required error={errors.bankName} onChange={onTextChange} />
      <TextField label="Account number (NUBAN)" name="accountNumber" value={values.accountNumber} required inputMode="numeric" autoComplete="off" help="Enter a 10-digit NUBAN account number." error={errors.accountNumber} onChange={onTextChange} />
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
  return <div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">{label}</dt><dd className="mt-1.5 break-words text-sm font-semibold text-star-800">{value || "Not available in this account session"}</dd></div>;
}
