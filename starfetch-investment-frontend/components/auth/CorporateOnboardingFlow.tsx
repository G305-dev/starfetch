"use client";

import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useMemo, useState } from "react";
import { CorporateApplicantDetailsForm } from "./CorporateApplicantDetailsForm";
import { CorporateBankDetailsForm } from "./CorporateBankDetailsForm";
import { CorporateOnboardingStepper } from "./CorporateOnboardingStepper";
import { MandateSelectionForm } from "./MandateSelectionForm";
import { corporateMandates, initialCorporateApplicationData, type CorporateApplicationData, type CorporateFieldErrors, type CorporateMandateId } from "./corporate-onboarding-data";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s()-]{7,20}$/;

const stepCopy = {
  1: { title: "Corporate Applicant Details", description: "Tell us about the institution opening this account." },
  2: { title: "Mandate Selection", description: "Select the investment mandate that best suits your institution." },
  3: { title: "Bank Details", description: "Provide the corporate bank account details that will be linked to this account." },
} as const;

export function CorporateOnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<CorporateApplicationData>(initialCorporateApplicationData);
  const [errors, setErrors] = useState<CorporateFieldErrors>({});

  const selectedMandate = useMemo(() => corporateMandates.find((mandate) => mandate.id === data.selectedMandate), [data.selectedMandate]);
  const currentCopy = stepCopy[step];

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const name = event.target.name as keyof CorporateApplicationData;
    let value = event.target.value;
    if (name === "accountNumber" || name === "linkedBvn") value = value.replace(/\D/g, "");

    setData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function validateApplicantDetails() {
    const nextErrors: CorporateFieldErrors = {};
    if (!data.institutionName.trim()) nextErrors.institutionName = "Enter the institution name.";
    if (!data.dateOfIncorporation) nextErrors.dateOfIncorporation = "Select the incorporation date.";
    else if (data.dateOfIncorporation > new Date().toISOString().slice(0, 10)) nextErrors.dateOfIncorporation = "Date of incorporation cannot be in the future.";
    if (!data.rcNumber.trim()) nextErrors.rcNumber = "Enter the RC number.";
    if (!data.taxIdentificationNumber.trim()) nextErrors.taxIdentificationNumber = "Enter the TIN.";
    if (!data.businessPhoneNumber.trim()) nextErrors.businessPhoneNumber = "Enter the business phone number.";
    else if (!phonePattern.test(data.businessPhoneNumber.trim())) nextErrors.businessPhoneNumber = "Enter a valid business phone number.";
    if (!data.businessEmail.trim()) nextErrors.businessEmail = "Enter the business email.";
    else if (!emailPattern.test(data.businessEmail.trim())) nextErrors.businessEmail = "Enter a valid business email.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateMandate() {
    const nextErrors: CorporateFieldErrors = data.selectedMandate ? {} : { selectedMandate: "Select one investment mandate to continue." };
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateBankDetails() {
    const nextErrors: CorporateFieldErrors = {};
    if (!data.bankName.trim()) nextErrors.bankName = "Enter the bank name.";
    if (!data.accountNumber.trim()) nextErrors.accountNumber = "Enter the account number.";
    else if (!/^\d{6,20}$/.test(data.accountNumber)) nextErrors.accountNumber = "Use 6 to 20 numeric digits for the account number.";
    if (!data.accountName.trim()) nextErrors.accountName = "Enter the account name.";
    else if (data.accountName.trim().length < 2 || data.accountName.trim().length > 100) nextErrors.accountName = "Use an account name between 2 and 100 characters.";
    if (!data.accountType) nextErrors.accountType = "Select the account type.";
    if (!data.linkedBvn.trim()) nextErrors.linkedBvn = "Enter the BVN linked to the account.";
    else if (!/^\d{11}$/.test(data.linkedBvn)) nextErrors.linkedBvn = "Enter the 11-digit BVN linked to the account.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function continueFromStep() {
    if (step === 1 && validateApplicantDetails()) setStep(2);
    if (step === 2 && validateMandate()) setStep(3);
  }

  function continueToDashboard() {
    const applicantValid = validateApplicantDetails();
    const mandateValid = Boolean(data.selectedMandate);
    const bankValid = validateBankDetails();
    if (!mandateValid) setErrors((current) => ({ ...current, selectedMandate: "Select one investment mandate to continue." }));
    if (applicantValid && mandateValid && bankValid) router.push("/corporate/dashboard");
  }

  const applicantFieldsPresent = Boolean(data.institutionName && data.dateOfIncorporation && data.rcNumber && data.taxIdentificationNumber && data.businessPhoneNumber && data.businessEmail);
  const bankFieldsPresent = Boolean(data.bankName && data.accountNumber && data.accountName && data.accountType && data.linkedBvn);

  return (
    <main className="min-h-[calc(100vh-76px)] bg-[#fffef9] px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16">
      <section className="mx-auto w-full max-w-3xl">
        <div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-star-100 text-star-700" aria-hidden="true"><Building2 size={24} /></span><p className="mt-5 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Account opening</p><h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Corporate Account Opening</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted sm:text-[0.96rem]">Complete the form below to open a corporate investment account with Starfetch.</p></div>
        <CorporateOnboardingStepper currentStep={step} />

        <section className="mt-8 rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:mt-10 sm:p-8" aria-labelledby="corporate-step-heading">
          <p className="text-xs font-bold text-star-700">Step {step} of 3</p>
          <h2 id="corporate-step-heading" className="mt-2 text-[clamp(1.45rem,2.5vw,2rem)] font-extrabold tracking-[-0.035em] text-star-900">{currentCopy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-star-muted">{currentCopy.description}</p>
          <div className="mt-7">
            {step === 1 ? <CorporateApplicantDetailsForm data={data} errors={errors} onChange={handleChange} /> : null}
            {step === 2 ? <MandateSelectionForm selectedMandate={data.selectedMandate} error={errors.selectedMandate} onSelect={(mandate: CorporateMandateId) => { setData((current) => ({ ...current, selectedMandate: mandate })); setErrors((current) => ({ ...current, selectedMandate: undefined })); }} /> : null}
            {step === 3 ? <><CorporateBankDetailsForm data={data} errors={errors} onChange={handleChange} /><ReviewSummary data={data} mandateTitle={selectedMandate?.title ?? "Not selected"} /></> : null}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-star-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            {step === 1 ? <button type="button" onClick={() => router.push("/open-account")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-5 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Cancel</button> : <button type="button" onClick={() => { setStep((current) => current === 3 ? 2 : 1); setErrors({}); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-5 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><ArrowLeft size={16} aria-hidden="true" />Back</button>}
            {step < 3 ? <button type="button" onClick={continueFromStep} disabled={step === 1 ? !applicantFieldsPresent : !data.selectedMandate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-star-200 disabled:text-star-muted disabled:hover:translate-y-0">Continue<ArrowRight size={16} aria-hidden="true" /></button> : <button type="button" onClick={continueToDashboard} disabled={!bankFieldsPresent} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-star-200 disabled:text-star-muted disabled:hover:translate-y-0">Continue to Dashboard<ArrowRight size={17} aria-hidden="true" /></button>}
          </div>
        </section>
      </section>
    </main>
  );
}

function ReviewSummary({ data, mandateTitle }: { data: CorporateApplicationData; mandateTitle: string }) {
  return (
    <section className="mt-7 rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="corporate-review-heading">
      <h3 id="corporate-review-heading" className="text-sm font-extrabold text-star-900">Review your information</h3>
      <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2"><ReviewItem label="Institution" value={data.institutionName || "Not provided"} /><ReviewItem label="Mandate" value={mandateTitle} /><ReviewItem label="Bank" value={data.bankName || "Not provided"} /><ReviewItem label="Account Number" value={data.accountNumber || "Not provided"} /><ReviewItem label="Account Name" value={data.accountName || "Not provided"} /><ReviewItem label="Account Type" value={data.accountType || "Not provided"} /></dl>
    </section>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-star-muted">{label}</dt><dd className="mt-1 break-words font-bold text-star-900">{value}</dd></div>;
}
