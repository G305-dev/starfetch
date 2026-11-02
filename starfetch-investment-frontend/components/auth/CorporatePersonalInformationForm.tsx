import type { ChangeEvent } from "react";
import type { CorporateApplicationData, CorporateFieldErrors } from "./corporate-onboarding-data";

type Props = {
  data: CorporateApplicationData;
  errors: CorporateFieldErrors;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function CorporatePersonalInformationForm({ data, errors, onChange }: Props) {
  return <div className="grid gap-5 sm:grid-cols-2"><PersonalInput label="Full Name" name="fullName" value={data.fullName} error={errors.fullName} onChange={onChange} autoComplete="name" className="sm:col-span-2" /><PersonalInput label="Email Address" name="personalEmail" type="email" value={data.personalEmail} error={errors.personalEmail} onChange={onChange} autoComplete="email" /><PersonalInput label="Phone Number" name="personalPhoneNumber" type="tel" value={data.personalPhoneNumber} error={errors.personalPhoneNumber} onChange={onChange} autoComplete="tel" /></div>;
}

type PersonalInputProps = {
  label: string;
  name: "fullName" | "personalEmail" | "personalPhoneNumber";
  value: string;
  error?: string;
  type?: "text" | "email" | "tel";
  autoComplete: string;
  className?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function PersonalInput({ label, name, value, error, type = "text", autoComplete, className = "", onChange }: PersonalInputProps) {
  const id = `business-${name}`;
  return <div className={className}><label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label} <span className="text-star-700" aria-hidden="true">*</span></label><input id={id} name={name} type={type} value={value} onChange={onChange} autoComplete={autoComplete} required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} />{error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}</div>;
}
