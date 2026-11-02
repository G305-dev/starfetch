"use client";

import { ArrowLeft, ArrowRight, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState } from "react";
import { CorporateApplicantDetailsForm } from "./CorporateApplicantDetailsForm";
import { CorporateOnboardingStepper } from "./CorporateOnboardingStepper";
import { CorporatePersonalInformationForm } from "./CorporatePersonalInformationForm";
import { CorporateSecurityInformationForm } from "./CorporateSecurityInformationForm";
import { initialCorporateApplicationData, type CorporateApplicationData, type CorporateFieldErrors } from "./corporate-onboarding-data";

const emailPattern = /^\S+@\S+\.\S+$/;
const phonePattern = /^\+?[0-9\s()-]{7,20}$/;

type BusinessOnboardingStep = 1 | 2 | 3;

const stepCopy: Record<BusinessOnboardingStep, { title: string; description: string }> = {
  1: { title: "Business Information", description: "Tell us about the business opening this account." },
  2: { title: "Personal Information", description: "Tell us about the authorized person completing this application." },
  3: { title: "Security Information", description: "Set a PIN and confirm your authority to onboard this business." },
};

export function CorporateOnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<BusinessOnboardingStep>(1);
  const [data, setData] = useState<CorporateApplicationData>(initialCorporateApplicationData);
  const [errors, setErrors] = useState<CorporateFieldErrors>({});
  const currentCopy = stepCopy[step];

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as keyof CorporateApplicationData;
    let value: string | boolean = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    if (typeof value === "string" && (name === "pin" || name === "confirmPin")) value = value.replace(/\D/g, "");
    setData((current) => ({ ...current, [name]: value } as CorporateApplicationData));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }

  function validateBusinessInformation() {
    const nextErrors: CorporateFieldErrors = {};
    if (!data.institutionName.trim()) nextErrors.institutionName = "Enter the business name.";
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

  function validatePersonalInformation() {
    const nextErrors: CorporateFieldErrors = {};
    if (!data.fullName.trim()) nextErrors.fullName = "Enter your full name.";
    else if (data.fullName.trim().length < 2) nextErrors.fullName = "Enter a valid full name.";
    if (!data.personalEmail.trim()) nextErrors.personalEmail = "Enter your email address.";
    else if (!emailPattern.test(data.personalEmail.trim())) nextErrors.personalEmail = "Enter a valid email address.";
    if (!data.personalPhoneNumber.trim()) nextErrors.personalPhoneNumber = "Enter your phone number.";
    else if (!phonePattern.test(data.personalPhoneNumber.trim())) nextErrors.personalPhoneNumber = "Enter a valid phone number.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateSecurityInformation() {
    const nextErrors: CorporateFieldErrors = {};
    if (!data.pin) nextErrors.pin = "Create a 4-digit PIN.";
    else if (!/^\d{4}$/.test(data.pin)) nextErrors.pin = "Your PIN must contain exactly 4 digits.";
    if (!data.confirmPin) nextErrors.confirmPin = "Re-enter your PIN.";
    else if (data.confirmPin !== data.pin) nextErrors.confirmPin = "Your PIN entries do not match.";
    if (!data.authorizationConfirmed) nextErrors.authorizationConfirmed = "Confirm your authorization and acceptance to continue.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function continueFromStep() {
    if (step === 1 && validateBusinessInformation()) setStep(2);
    if (step === 2 && validatePersonalInformation()) setStep(3);
  }

  function completeApplication() {
    if (validateSecurityInformation()) router.push("/corporate/dashboard");
  }

  function goBack() {
    setErrors({});
    setStep((current) => current === 3 ? 2 : 1);
  }

  return <main className="min-h-[calc(100vh-76px)] bg-[#fffef9] px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16"><section className="mx-auto w-full max-w-3xl"><div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-star-100 text-star-700" aria-hidden="true"><Building2 size={24} /></span><p className="mt-5 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Account opening</p><h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Business Account Opening</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted sm:text-[0.96rem]">Complete the three steps below to open a business investment account with Starfetch.</p></div><CorporateOnboardingStepper currentStep={step} /><section className="mt-8 rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:mt-10 sm:p-8" aria-labelledby="business-step-heading"><p className="text-xs font-bold text-star-700">Step {step} of 3</p><h2 id="business-step-heading" className="mt-2 text-[clamp(1.45rem,2.5vw,2rem)] font-extrabold tracking-[-0.035em] text-star-900">{currentCopy.title}</h2><p className="mt-2 text-sm leading-6 text-star-muted">{currentCopy.description}</p><div className="mt-7">{step === 1 ? <CorporateApplicantDetailsForm data={data} errors={errors} onChange={handleChange} /> : null}{step === 2 ? <CorporatePersonalInformationForm data={data} errors={errors} onChange={handleChange} /> : null}{step === 3 ? <CorporateSecurityInformationForm data={data} errors={errors} onChange={handleChange} /> : null}</div><div className="mt-8 flex flex-col-reverse gap-3 border-t border-star-100 pt-6 sm:flex-row sm:items-center sm:justify-between">{step === 1 ? <button type="button" onClick={() => router.push("/open-account")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-5 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Cancel</button> : <button type="button" onClick={goBack} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-5 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><ArrowLeft size={16} aria-hidden="true" />Back</button>}{step < 3 ? <button type="button" onClick={continueFromStep} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Continue<ArrowRight size={16} aria-hidden="true" /></button> : <button type="button" onClick={completeApplication} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Complete Application<ArrowRight size={17} aria-hidden="true" /></button>}</div></section></section></main>;
}
