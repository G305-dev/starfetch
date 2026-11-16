"use client";

import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, LoaderCircle, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getMyCorporateProfile,
  getSafeErrorMessage,
  isApiError,
  saveCorporateBankDetails,
  saveCorporateCompanyDetails,
  saveCorporateInvestmentProfile,
  saveCorporateSourceOfFunds,
} from "@/lib/api/client";
import {
  corporateInvestmentHorizonOptions,
  corporateInvestmentObjectives,
  corporateRiskToleranceOptions,
  corporateSourceOfFundsOptions,
  emptyCorporateBankDetails,
  emptyCorporateCompanyDetails,
  emptyCorporateInvestmentProfile,
  emptyCorporateSourceOfFunds,
  type CorporateBankDetails,
  type CorporateCompanyDetails,
  type CorporateInvestmentProfile,
  type CorporateProfile,
  type CorporateProfileSectionStates,
  type CorporateSourceOfFunds,
} from "@/lib/corporate/profile";

type SectionKey = keyof CorporateProfileSectionStates;
type LoadState = "loading" | "ready" | "error" | "signed-out";
type FieldErrors = Record<string, string>;
type CompanyForm = CorporateCompanyDetails & { taxIdentificationNumber: string };
type BankForm = CorporateBankDetails & { accountNumber: string };

type SectionDefinition = { key: SectionKey; title: string; shortTitle: string; description: string };

const sections: SectionDefinition[] = [
  { key: "companyDetails", title: "Corporate Applicant Information & Company Details", shortTitle: "Company details", description: "Review the company identity supplied during account creation and complete the registered-company details." },
  { key: "investmentProfile", title: "Investment Objective & Risk Profile", shortTitle: "Investment profile", description: "Tell us about the company’s investment objectives, risk tolerance, horizon, and liquidity expectations." },
  { key: "sourceOfFunds", title: "Source of Funds and Wealth", shortTitle: "Source of funds", description: "Select the source or sources of funds and provide the expected inflow and transaction frequency." },
  { key: "bankDetails", title: "Bank Details", shortTitle: "Bank details", description: "Provide the account details the company intends to use for distributions." },
];

const initialCompanyForm: CompanyForm = { ...emptyCorporateCompanyDetails(), taxIdentificationNumber: "" };
const initialInvestmentForm: CorporateInvestmentProfile = emptyCorporateInvestmentProfile();
const initialSourceForm: CorporateSourceOfFunds = emptyCorporateSourceOfFunds();
const initialBankForm: BankForm = { ...emptyCorporateBankDetails(), accountNumber: "" };

function firstIncompleteSection(sectionStates: CorporateProfileSectionStates) {
  const index = sections.findIndex((section) => sectionStates[section.key] !== "COMPLETE");
  return index < 0 ? sections.length - 1 : index;
}

function furthestSequentialSection(sectionStates: CorporateProfileSectionStates) {
  let furthest = 0;
  for (let index = 0; index < sections.length - 1; index += 1) {
    if (sectionStates[sections[index].key] !== "COMPLETE") break;
    furthest = index + 1;
  }
  return furthest;
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

function hydrateForms(profile: CorporateProfile) {
  return {
    company: { ...profile.companyDetails, taxIdentificationNumber: "" },
    investment: { ...profile.investmentProfile },
    source: { ...profile.sourceOfFunds, selectedSources: [...profile.sourceOfFunds.selectedSources] },
    bank: { ...profile.bankDetails, accountNumber: "" },
  };
}

function requestErrorMessage(error: unknown) {
  if (isApiError(error) && error.code === "CONFLICT") return "This Corporate Profile changed in another session. We are reloading the latest saved version; review it before making another change.";
  return getSafeErrorMessage(error);
}

function stateLabel(status: CorporateProfileSectionStates[SectionKey]) {
  if (status === "COMPLETE") return "Complete";
  if (status === "DRAFT") return "Draft saved";
  return "Not started";
}

function validateSection(index: number, company: CompanyForm, investment: CorporateInvestmentProfile, source: CorporateSourceOfFunds, bank: BankForm, profile: CorporateProfile): FieldErrors {
  const errors: FieldErrors = {};
  const required = (name: string, value: string, label: string) => { if (!value.trim()) errors[name] = `Enter ${label}.`; };

  if (index === 0) {
    required("rcNumber", company.rcNumber, "the RC number");
    if (!company.dateOfIncorporation) errors.dateOfIncorporation = "Select the date of incorporation.";
    else if (!dateIsValidAndNotFuture(company.dateOfIncorporation)) errors.dateOfIncorporation = "Enter a valid incorporation date that is not in the future.";
    if (!profile.companyDetails.taxIdentificationNumberMasked && !company.taxIdentificationNumber.trim()) errors.taxIdentificationNumber = "Enter the company TIN.";
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
    if (!bank.accountNumber.trim() && !profile.bankDetails.accountNumberMasked) errors.accountNumber = "Enter the 10-digit NUBAN account number.";
    else if (bank.accountNumber.trim() && !/^\d{10}$/.test(bank.accountNumber.trim())) errors.accountNumber = "Enter a valid 10-digit NUBAN account number.";
    required("accountName", bank.accountName, "the account name");
    required("accountType", bank.accountType, "the account type");
    if (bank.bvnLinkedToAccount === null) errors.bvnLinkedToAccount = "Confirm whether the account is BVN-linked.";
  }
  return errors;
}

export function CorporateProfileContent() {
  const { status: authStatus, user } = useAuth();
  const activeUserId = useRef<string | null>(null);
  const requestEpoch = useRef(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<CorporateProfile | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [company, setCompany] = useState<CompanyForm>(initialCompanyForm);
  const [investment, setInvestment] = useState<CorporateInvestmentProfile>(initialInvestmentForm);
  const [source, setSource] = useState<CorporateSourceOfFunds>(initialSourceForm);
  const [bank, setBank] = useState<BankForm>(initialBankForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [dirtySections, setDirtySections] = useState<Set<SectionKey>>(() => new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function applyProfile(next: CorporateProfile) {
    const forms = hydrateForms(next);
    setProfile(next);
    setCompany(forms.company);
    setInvestment(forms.investment);
    setSource(forms.source);
    setBank(forms.bank);
    setDirtySections(new Set());
  }

  async function loadProfile(ownerId: string, noticeAfterLoad?: string) {
    const epoch = requestEpoch.current + 1;
    requestEpoch.current = epoch;
    setLoadState("loading");
    setSaveError(null);
    setSaveNotice(null);
    try {
      const result = await getMyCorporateProfile();
      if (requestEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      applyProfile(result);
      setActiveStep(firstIncompleteSection(result.sections));
      setFieldErrors({});
      setSaveNotice(noticeAfterLoad ?? null);
      setLoadState("ready");
    } catch (error) {
      if (requestEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      setProfile(null);
      setLoadState("error");
      setSaveError(requestErrorMessage(error));
    }
  }

  useEffect(() => {
    const ownerId = authStatus === "authenticated" && user ? user.id : null;
    activeUserId.current = ownerId;
    requestEpoch.current += 1;
    setProfile(null);
    setActiveStep(0);
    setCompany(initialCompanyForm);
    setInvestment(initialInvestmentForm);
    setSource(initialSourceForm);
    setBank(initialBankForm);
    setFieldErrors({});
    setDirtySections(new Set());
    setSaveError(null);
    setSaveNotice(null);
    setSaving(false);
    if (!ownerId) {
      setLoadState(authStatus === "loading" ? "loading" : "signed-out");
      return;
    }
    void loadProfile(ownerId);
  }, [authStatus, user?.id]);

  function markChanged() {
    setDirtySections((current) => new Set(current).add(sections[activeStep].key));
    setSaveError(null);
    setSaveNotice(null);
  }

  async function saveActiveSection(continueAfterSave: boolean) {
    if (!profile || !user || saving) return;
    const errors = continueAfterSave ? validateSection(activeStep, company, investment, source, bank, profile) : {};
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setSaveError("Complete the highlighted required fields before continuing. You can save a draft and return to this section later.");
      return;
    }

    const ownerId = user.id;
    const epoch = requestEpoch.current + 1;
    requestEpoch.current = epoch;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);

    try {
      let updated: CorporateProfile;
      if (activeStep === 0) {
        updated = await saveCorporateCompanyDetails({
          rcNumber: company.rcNumber.trim(),
          dateOfIncorporation: company.dateOfIncorporation,
          ...(company.taxIdentificationNumber.trim() ? { taxIdentificationNumber: company.taxIdentificationNumber.trim() } : {}),
          registeredAddress: company.registeredAddress.trim(),
          city: company.city.trim(),
          state: company.state.trim(),
        }, profile.version);
      } else if (activeStep === 1) {
        updated = await saveCorporateInvestmentProfile({ ...investment }, profile.version);
      } else if (activeStep === 2) {
        updated = await saveCorporateSourceOfFunds({
          selectedSources: [...source.selectedSources],
          otherSource: source.otherSource.trim(),
          expectedAnnualInflow: source.expectedAnnualInflow.trim(),
          expectedTransactionFrequency: source.expectedTransactionFrequency.trim(),
        }, profile.version);
      } else {
        updated = await saveCorporateBankDetails({
          bankName: bank.bankName.trim(),
          ...(bank.accountNumber.trim() ? { accountNumber: bank.accountNumber.trim() } : {}),
          accountName: bank.accountName.trim(),
          accountType: bank.accountType.trim(),
          bvnLinkedToAccount: bank.bvnLinkedToAccount,
        }, profile.version);
      }

      if (requestEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      applyProfile(updated);
      setFieldErrors({});
      const currentStatus = updated.sections[sections[activeStep].key];
      if (continueAfterSave && currentStatus !== "COMPLETE") {
        setSaveError("The server saved this section but has not confirmed it as complete. Review the required fields before opening the next section.");
        return;
      }
      if (continueAfterSave && activeStep < sections.length - 1) {
        const nextStep = activeStep + 1;
        if (updated.sections[sections[nextStep - 1].key] === "COMPLETE") {
          setActiveStep(nextStep);
          setSaveNotice(`${sections[activeStep].shortTitle} saved. Continue with ${sections[nextStep].shortTitle}.`);
          return;
        }
      }
      const allComplete = sections.every((section) => updated.sections[section.key] === "COMPLETE");
      setSaveNotice(allComplete
        ? "All four profile sections are saved as complete. This does not represent Corporate verification, approval, or investment authorisation."
        : currentStatus === "COMPLETE"
          ? `${sections[activeStep].shortTitle} is saved as complete.`
          : `${sections[activeStep].shortTitle} draft saved. Complete this section before moving to the next one.`);
    } catch (error) {
      if (requestEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      setSaveError(requestErrorMessage(error));
      if (isApiError(error) && error.code === "CONFLICT") {
        setCompany((current) => ({ ...current, taxIdentificationNumber: "" }));
        setBank((current) => ({ ...current, accountNumber: "" }));
        void loadProfile(ownerId, "This save was not applied because another session changed the profile. The latest saved details are shown; sensitive TIN or account-number entries must be entered again if needed.");
      }
    } finally {
      if (activeUserId.current === ownerId) setSaving(false);
    }
  }

  if (loadState === "loading") return <main className="grid min-h-[45vh] place-items-center" aria-busy="true"><div className="text-center"><LoaderCircle size={27} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-star-muted">Loading your saved Corporate Profile…</p></div></main>;

  if (loadState !== "ready" || !profile) {
    const signedOut = loadState === "signed-out";
    return <main className="min-w-0" aria-labelledby="corporate-profile-heading"><header className="mb-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate account</p><h1 id="corporate-profile-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Company profile</h1></header><section className="rounded-xl border border-star-200 bg-white p-6" role={signedOut ? "status" : "alert"}><div className="flex items-start gap-3"><ShieldCheck size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><div><h2 className="text-base font-extrabold text-star-900">{signedOut ? "Sign in to view your Corporate Profile" : "Corporate Profile could not be loaded"}</h2><p className="mt-1 text-sm leading-6 text-star-muted">{signedOut ? "Your company information is available only to the authenticated Corporate applicant." : saveError ?? "The owner-scoped Corporate Profile service did not return a usable profile. No local or sample company data is shown."}</p>{!signedOut ? <button type="button" onClick={() => { if (user) void loadProfile(user.id); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-star-200 px-3 text-sm font-extrabold text-star-700 hover:bg-star-50"><RefreshCw size={15} aria-hidden="true" />Retry profile load</button> : null}</div></div></section></main>;
  }

  const currentSection = sections[activeStep];
  const furthestStep = furthestSequentialSection(profile.sections);
  const allComplete = sections.every((section) => profile.sections[section.key] === "COMPLETE");

  function visitSection(index: number) {
    const dirtyEarlierSection = sections.slice(0, index).some((section) => dirtySections.has(section.key));
    if (saving || index > activeStep && (index > furthestStep || dirtyEarlierSection)) return;
    setActiveStep(index);
    setFieldErrors({});
    setSaveError(null);
    setSaveNotice(null);
  }

  const previousSection = activeStep > 0 ? sections[activeStep - 1] : null;

  return (
    <main className="min-w-0" aria-labelledby="corporate-profile-heading">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate account</p>
        <h1 id="corporate-profile-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Company profile</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-star-muted">Complete the four sections in order. Company identity from account creation is read-only; each profile section is saved to the authenticated company record before you continue.</p>
      </header>

      {allComplete ? <p className="mb-5 rounded-lg border border-[#bfe8ca] bg-[#effbf2] px-4 py-3 text-sm leading-6 text-star-800" role="status"><span className="font-extrabold">All four profile sections are saved as complete.</span> This is not a Corporate verification, approval, compliance decision, or investment authorisation.</p> : null}

      <nav aria-label="Corporate Profile sections" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sections.map((section, index) => {
          const sectionStatus = profile.sections[section.key];
          const dirtyEarlierSection = sections.slice(0, index).some((earlier) => dirtySections.has(earlier.key));
          const disabled = saving || index > activeStep && (index > furthestStep || dirtyEarlierSection);
          const active = index === activeStep;
          return <button key={section.key} type="button" onClick={() => visitSection(index)} disabled={disabled} aria-current={active ? "step" : undefined} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${active ? "border-star-700 bg-star-50 shadow-sm" : sectionStatus === "COMPLETE" ? "border-[#bfe8ca] bg-white hover:bg-[#f7fcf8]" : "border-star-200 bg-white hover:bg-star-50"}`}>
            <span className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold uppercase tracking-[0.11em] text-star-700">Section {index + 1}</span>{sectionStatus === "COMPLETE" ? <CheckCircle2 size={17} className="text-[#16743d]" aria-label="Complete" /> : <Circle size={17} className="text-star-300" aria-hidden="true" />}</span>
            <span className="mt-2 block text-sm font-extrabold text-star-900">{section.shortTitle}</span>
            <span className="mt-1 block text-xs font-semibold text-star-muted">{stateLabel(sectionStatus)}</span>
          </button>;
        })}
      </nav>

      <section className="mt-5 rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="corporate-profile-step-heading">
        <div className="border-b border-star-100 px-5 py-5 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Section {activeStep + 1} of {sections.length} · {stateLabel(profile.sections[currentSection.key])}</p>
          <h2 id="corporate-profile-step-heading" className="mt-2 text-xl font-extrabold tracking-[-0.025em] text-star-900">{currentSection.title}</h2>
          <p className="mt-2 text-sm leading-6 text-star-muted">{currentSection.description}</p>
        </div>

        <form noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void saveActiveSection(true); }} className="p-5 sm:p-6">
          {activeStep === 0 ? <CompanyDetailsSection profile={profile} values={company} errors={fieldErrors} onChange={(name, value) => { setCompany((current) => ({ ...current, [name]: value })); setFieldErrors((current) => ({ ...current, [name]: "" })); markChanged(); }} /> : null}
          {activeStep === 1 ? <InvestmentSection values={investment} errors={fieldErrors} onChange={(name, value) => { setInvestment((current) => ({ ...current, [name]: value })); setFieldErrors((current) => ({ ...current, [name]: "" })); markChanged(); }} /> : null}
          {activeStep === 2 ? <SourceOfFundsSection values={source} errors={fieldErrors} onTextChange={(name, value) => { setSource((current) => ({ ...current, [name]: value })); setFieldErrors((current) => ({ ...current, [name]: "" })); markChanged(); }} onToggleSource={(option, checked) => { setSource((current) => ({ ...current, selectedSources: checked ? [...current.selectedSources, option] : current.selectedSources.filter((item) => item !== option), ...(option === "Other (specify)" && !checked ? { otherSource: "" } : {}) })); setFieldErrors((current) => ({ ...current, selectedSources: "", otherSource: "" })); markChanged(); }} /> : null}
          {activeStep === 3 ? <BankDetailsSection values={bank} errors={fieldErrors} onTextChange={(name, value) => { setBank((current) => ({ ...current, [name]: value })); setFieldErrors((current) => ({ ...current, [name]: "" })); markChanged(); }} onBvnChange={(value) => { setBank((current) => ({ ...current, bvnLinkedToAccount: value })); setFieldErrors((current) => ({ ...current, bvnLinkedToAccount: "" })); markChanged(); }} /> : null}

          {saveError ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{saveError}</p> : null}
          {saveNotice ? <p role="status" className="mt-5 rounded-lg border border-[#bfe8ca] bg-[#effbf2] px-4 py-3 text-sm leading-6 text-star-800">{saveNotice}</p> : null}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            {previousSection ? <button type="button" onClick={() => visitSection(activeStep - 1)} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50 disabled:cursor-not-allowed disabled:opacity-60"><ArrowLeft size={16} aria-hidden="true" />Previous section</button> : <span />}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => { void saveActiveSection(false); }} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}Save draft</button>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Saving section…</> : activeStep === sections.length - 1 ? <>Save Bank Details<CheckCircle2 size={16} aria-hidden="true" /></> : <>Save & continue<ArrowRight size={16} aria-hidden="true" /></>}</button>
            </div>
          </div>
        </form>
      </section>

      <p className="mt-4 text-xs leading-5 text-star-muted">Profile fields and completion states are returned by the authenticated backend. Section completion is not a Corporate KYC/KYB approval or authorisation to transact.</p>
    </main>
  );
}

function CompanyDetailsSection({ profile, values, errors, onChange }: { profile: CorporateProfile; values: CompanyForm; errors: FieldErrors; onChange: (name: string, value: string) => void }) {
  return <div className="space-y-6">
    <section className="rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="corporate-applicant-information-heading">
      <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-star-700"><Building2 size={18} aria-hidden="true" /></span><div><h3 id="corporate-applicant-information-heading" className="text-base font-extrabold text-star-900">Corporate applicant information</h3><p className="mt-1 text-sm leading-6 text-star-muted">These account-managed details were supplied during Corporate account creation and cannot be edited here.</p></div></div>
      <dl className="mt-4 grid gap-4 border-t border-star-200 pt-4 sm:grid-cols-3">
        <ReadOnlyValue label="Company name" value={profile.applicant.companyName} />
        <ReadOnlyValue label="Company phone number" value={profile.applicant.companyPhoneNumber} />
        <ReadOnlyValue label="Account email" value={profile.applicant.email} />
      </dl>
    </section>
    <section aria-labelledby="corporate-registered-details-heading">
      <h3 id="corporate-registered-details-heading" className="text-base font-extrabold text-star-900">Registered company details</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TextField label="RC number" name="rcNumber" value={values.rcNumber} required error={errors.rcNumber} onChange={onChange} />
        <TextField label="Date of incorporation" name="dateOfIncorporation" type="date" value={values.dateOfIncorporation} required error={errors.dateOfIncorporation} onChange={onChange} />
        <TextField label="TIN number" name="taxIdentificationNumber" value={values.taxIdentificationNumber} required={!profile.companyDetails.taxIdentificationNumberMasked} autoComplete="off" help={profile.companyDetails.taxIdentificationNumberMasked ? `A TIN is already on file (${profile.companyDetails.taxIdentificationNumberMasked}). Leave blank to keep it, or enter a replacement.` : undefined} error={errors.taxIdentificationNumber} onChange={onChange} />
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
      <TextField label="Account number (NUBAN)" name="accountNumber" value={values.accountNumber} required={!values.accountNumberMasked} inputMode="numeric" autoComplete="off" help={values.accountNumberMasked ? `A saved account number is masked (${values.accountNumberMasked}). Leave blank to keep it, or enter a new 10-digit NUBAN.` : "Enter a 10-digit NUBAN account number."} error={errors.accountNumber} onChange={onTextChange} />
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

function RadioGroup({ label, name, options, value, onChange, error }: { label: string; name: keyof CorporateInvestmentProfile; options: readonly string[]; value: string; onChange: (name: keyof CorporateInvestmentProfile, value: string) => void; error?: string }) {
  return <fieldset>
    <legend className="text-sm font-extrabold text-star-900">{label} <span className="text-star-700" aria-hidden="true">*</span></legend>
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {options.map((option) => <label key={option} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-star-200 bg-white px-3.5 text-sm font-semibold text-star-800 hover:bg-star-50"><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(name, option)} className="size-4 border-star-300 text-star-700 focus:ring-2 focus:ring-star-700" />{option}</label>)}
    </div>
    {error ? <p className="mt-2 text-xs font-medium text-red-700" role="alert">{error}</p> : null}
  </fieldset>;
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">{label}</dt><dd className="mt-1.5 break-words text-sm font-semibold text-star-800">{value || "Not supplied"}</dd></div>;
}
