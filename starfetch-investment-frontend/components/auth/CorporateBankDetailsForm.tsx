import type { ChangeEvent } from "react";
import { accountTypeOptions, type CorporateAccountType, type CorporateApplicationData, type CorporateFieldErrors } from "./corporate-onboarding-data";

type Props = {
  data: CorporateApplicationData;
  errors: CorporateFieldErrors;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

export function CorporateBankDetailsForm({ data, errors, onChange }: Props) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <BankInput label="Bank Name" name="bankName" value={data.bankName} error={errors.bankName} onChange={onChange} className="sm:col-span-2" />
      <BankInput label="Account Number" name="accountNumber" value={data.accountNumber} error={errors.accountNumber} onChange={onChange} inputMode="numeric" maxLength={20} />
      <BankInput label="Account Name" name="accountName" value={data.accountName} error={errors.accountName} onChange={onChange} />
      <div>
        <label htmlFor="corporate-accountType" className="mb-2 block text-sm font-bold text-star-900">Account Type <span className="text-star-700" aria-hidden="true">*</span></label>
        <select id="corporate-accountType" name="accountType" value={data.accountType} onChange={onChange} required aria-invalid={Boolean(errors.accountType)} aria-describedby={errors.accountType ? "corporate-accountType-error" : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${errors.accountType ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`}>
          <option value="">Select account type</option>
          {accountTypeOptions.map((accountType) => <option key={accountType} value={accountType}>{accountType}</option>)}
        </select>
        {errors.accountType ? <p id="corporate-accountType-error" className="mt-2 text-xs font-medium text-red-700">{errors.accountType}</p> : null}
      </div>
      <BankInput label="BVN Linked to Account" name="linkedBvn" value={data.linkedBvn} error={errors.linkedBvn} onChange={onChange} inputMode="numeric" maxLength={11} />
    </div>
  );
}

type BankInputProps = {
  label: string;
  name: Extract<keyof CorporateApplicationData, "bankName" | "accountNumber" | "accountName" | "linkedBvn">;
  value: string;
  error?: string;
  className?: string;
  inputMode?: "numeric";
  maxLength?: number;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
};

function BankInput({ label, name, value, error, className = "", inputMode, maxLength, onChange }: BankInputProps) {
  const id = `corporate-${name}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label} <span className="text-star-700" aria-hidden="true">*</span></label>
      <input id={id} name={name} value={value} onChange={onChange} required inputMode={inputMode} maxLength={maxLength} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} />
      {error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
