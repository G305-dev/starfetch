"use client";

import { type FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";

type ApplicantDetails = {
  firstName: string;
  middleName: string;
  surname: string;
  dateOfBirth: string;
  email: string;
  phoneNumber: string;
};

type ApplicantErrors = Partial<Record<keyof ApplicantDetails, string>>;

type ApplicantId = "applicant1" | "applicant2";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emptyApplicant: ApplicantDetails = {
  firstName: "",
  middleName: "",
  surname: "",
  dateOfBirth: "",
  email: "",
  phoneNumber: "",
};

function validateApplicant(applicant: ApplicantDetails): ApplicantErrors {
  const errors: ApplicantErrors = {};
  if (!applicant.firstName.trim()) errors.firstName = "Enter the applicant's first name.";
  if (!applicant.surname.trim()) errors.surname = "Enter the applicant's surname.";
  if (!applicant.dateOfBirth) errors.dateOfBirth = "Enter the applicant's date of birth.";
  else {
    const date = new Date(`${applicant.dateOfBirth}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date >= new Date()) errors.dateOfBirth = "Enter a valid date of birth in the past.";
  }
  if (!applicant.email.trim()) errors.email = "Enter the applicant's email address.";
  else if (!emailPattern.test(applicant.email.trim())) errors.email = "Enter a valid email address.";
  if (!applicant.phoneNumber.trim()) errors.phoneNumber = "Enter the applicant's phone number.";
  return errors;
}

export function JointApplicantDetailsForm() {
  const router = useRouter();
  const [applicant1, setApplicant1] = useState<ApplicantDetails>(emptyApplicant);
  const [applicant2, setApplicant2] = useState<ApplicantDetails>(emptyApplicant);
  const [applicant1Errors, setApplicant1Errors] = useState<ApplicantErrors>({});
  const [applicant2Errors, setApplicant2Errors] = useState<ApplicantErrors>({});

  function updateApplicant(applicantId: ApplicantId, field: keyof ApplicantDetails, value: string) {
    const setApplicant = applicantId === "applicant1" ? setApplicant1 : setApplicant2;
    const setErrors = applicantId === "applicant1" ? setApplicant1Errors : setApplicant2Errors;
    setApplicant((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function continueToDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextApplicant1Errors = validateApplicant(applicant1);
    const nextApplicant2Errors = validateApplicant(applicant2);
    setApplicant1Errors(nextApplicant1Errors);
    setApplicant2Errors(nextApplicant2Errors);
    if (Object.keys(nextApplicant1Errors).length || Object.keys(nextApplicant2Errors).length) return;
    router.push("/joint/dashboard");
  }

  return <section className="mx-auto w-full max-w-6xl"><header className="mx-auto max-w-2xl text-center"><p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Joint account</p><h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Joint Account Holders</h1><p className="mx-auto mt-3 text-sm leading-6 text-star-muted sm:text-[0.96rem]">Provide the basic details of both applicants who will own this joint account.</p></header><form noValidate onSubmit={continueToDashboard} className="mt-9"><div className="grid gap-5 lg:grid-cols-2"><ApplicantCard number={1} applicant={applicant1} errors={applicant1Errors} onChange={(field, value) => updateApplicant("applicant1", field, value)} /><ApplicantCard number={2} applicant={applicant2} errors={applicant2Errors} onChange={(field, value) => updateApplicant("applicant2", field, value)} /></div><button type="submit" className="mx-auto mt-7 inline-flex min-h-12 w-full max-w-sm items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0">Continue</button></form></section>;
}

type ApplicantCardProps = {
  number: 1 | 2;
  applicant: ApplicantDetails;
  errors: ApplicantErrors;
  onChange: (field: keyof ApplicantDetails, value: string) => void;
};

function ApplicantCard({ number, applicant, errors, onChange }: ApplicantCardProps) {
  const firstNameId = useId();
  const middleNameId = useId();
  const surnameId = useId();
  const dateOfBirthId = useId();
  const emailId = useId();
  const phoneId = useId();
  const prefix = `joint-applicant-${number}`;

  return <section className="rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:p-7" aria-labelledby={`${prefix}-heading`}><div className="flex items-center gap-3 border-b border-star-100 pb-5"><span className="grid size-10 place-items-center rounded-full bg-star-100 text-sm font-extrabold text-star-700" aria-hidden="true">{number}</span><h2 id={`${prefix}-heading`} className="text-xl font-extrabold text-star-900">Applicant {number}</h2></div><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="First Name" id={firstNameId} name="firstName" value={applicant.firstName} error={errors.firstName} autoComplete="given-name" onChange={onChange} /><Field label="Middle Name" optional id={middleNameId} name="middleName" value={applicant.middleName} error={errors.middleName} autoComplete="additional-name" onChange={onChange} /><Field label="Surname" id={surnameId} name="surname" value={applicant.surname} error={errors.surname} autoComplete="family-name" onChange={onChange} /><Field label="Date of Birth" id={dateOfBirthId} name="dateOfBirth" type="date" value={applicant.dateOfBirth} error={errors.dateOfBirth} autoComplete="bday" onChange={onChange} /><Field label="Email Address" id={emailId} name="email" type="email" value={applicant.email} error={errors.email} autoComplete="email" onChange={onChange} className="sm:col-span-2" /><Field label="Phone Number" id={phoneId} name="phoneNumber" type="tel" value={applicant.phoneNumber} error={errors.phoneNumber} autoComplete="tel" onChange={onChange} className="sm:col-span-2" /></div></section>;
}

type FieldProps = {
  label: string;
  optional?: boolean;
  id: string;
  name: keyof ApplicantDetails;
  value: string;
  error?: string;
  type?: "text" | "email" | "tel" | "date";
  autoComplete: string;
  className?: string;
  onChange: (field: keyof ApplicantDetails, value: string) => void;
};

function Field({ label, optional = false, id, name, value, error, type = "text", autoComplete, className = "", onChange }: FieldProps) {
  const errorId = `${id}-error`;
  return <div className={className}><label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label}{optional ? <span className="ml-1 font-medium text-star-muted">— optional</span> : <span className="ml-1 text-star-700" aria-hidden="true">*</span>}</label><input id={id} type={type} value={value} onChange={(event) => onChange(name, event.target.value)} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} />{error ? <p id={errorId} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}</div>;
}
