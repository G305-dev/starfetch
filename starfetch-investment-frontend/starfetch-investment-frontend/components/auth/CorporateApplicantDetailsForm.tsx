import type { ChangeEvent } from "react";
import type { CorporateApplicationData, CorporateFieldErrors } from "./corporate-onboarding-data";

type Props = {
  data: CorporateApplicationData;
  errors: CorporateFieldErrors;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function CorporateApplicantDetailsForm({ data, errors, onChange }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <CorporateInput label="Name of Institution" name="institutionName" value={data.institutionName} error={errors.institutionName} onChange={onChange} autoComplete="organization" className="sm:col-span-2" />
      <CorporateInput label="Date of Incorporation" name="dateOfIncorporation" type="date" value={data.dateOfIncorporation} error={errors.dateOfIncorporation} onChange={onChange} />
      <CorporateInput label="RC Number" name="rcNumber" value={data.rcNumber} error={errors.rcNumber} onChange={onChange} />
      <CorporateInput label="Tax Identification Number (TIN)" name="taxIdentificationNumber" value={data.taxIdentificationNumber} error={errors.taxIdentificationNumber} onChange={onChange} />
      <CorporateInput label="Business Phone Number" name="businessPhoneNumber" type="tel" value={data.businessPhoneNumber} error={errors.businessPhoneNumber} onChange={onChange} autoComplete="tel" />
      <CorporateInput label="Business Email" name="businessEmail" type="email" value={data.businessEmail} error={errors.businessEmail} onChange={onChange} autoComplete="email" className="sm:col-span-2" />
    </div>
  );
}

type InputProps = {
  label: string;
  name: keyof CorporateApplicationData;
  value: string;
  error?: string;
  type?: "text" | "date" | "email" | "tel";
  autoComplete?: string;
  className?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function CorporateInput({ label, name, value, error, type = "text", autoComplete, className = "", onChange }: InputProps) {
  const id = `corporate-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label} <span className="text-star-700" aria-hidden="true">*</span></label>
      <input id={id} name={name} type={type} value={value} onChange={onChange} autoComplete={autoComplete} required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} />
      {error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
