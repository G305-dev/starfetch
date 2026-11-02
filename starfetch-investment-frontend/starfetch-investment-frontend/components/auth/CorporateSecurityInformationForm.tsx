"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import type { CorporateApplicationData, CorporateFieldErrors } from "./corporate-onboarding-data";

type Props = {
  data: CorporateApplicationData;
  errors: CorporateFieldErrors;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function CorporateSecurityInformationForm({ data, errors, onChange }: Props) {
  const [pinVisible, setPinVisible] = useState(false);
  const [confirmPinVisible, setConfirmPinVisible] = useState(false);
  return <div><div className="grid gap-5 sm:grid-cols-2"><PinInput label="PIN" name="pin" value={data.pin} error={errors.pin} visible={pinVisible} onChange={onChange} onToggle={() => setPinVisible((visible) => !visible)} /><PinInput label="Re-enter PIN" name="confirmPin" value={data.confirmPin} error={errors.confirmPin} visible={confirmPinVisible} onChange={onChange} onToggle={() => setConfirmPinVisible((visible) => !visible)} /></div><section className={`mt-6 rounded-xl border p-4 ${errors.authorizationConfirmed ? "border-red-300 bg-red-50" : "border-star-200 bg-star-50"}`} aria-labelledby="business-authorization-heading"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-star-700 shadow-sm"><ShieldCheck size={18} aria-hidden="true" /></span><div className="min-w-0"><h3 id="business-authorization-heading" className="text-sm font-extrabold text-star-900">Authorization checklist</h3><label className="mt-3 flex cursor-pointer items-start gap-3 text-sm leading-6 text-star-muted"><input name="authorizationConfirmed" type="checkbox" checked={data.authorizationConfirmed} onChange={onChange} aria-invalid={Boolean(errors.authorizationConfirmed)} aria-describedby={errors.authorizationConfirmed ? "business-authorization-error" : undefined} className="mt-1 size-4 shrink-0 rounded border-star-300 text-star-700 focus:ring-2 focus:ring-star-700" /><span>I confirm that I am duly authorized to onboard this business and I agree to the i-invest <a href="https://i-investng.com/terms-and-conditions/" target="_blank" rel="noreferrer" className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-2 hover:text-star-900">Terms &amp; Conditions</a> and have read through the i-invest <a href="https://i-investng.com/privacy-policy/" target="_blank" rel="noreferrer" className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-2 hover:text-star-900">Privacy Policy</a>.</span></label>{errors.authorizationConfirmed ? <p id="business-authorization-error" className="mt-2 text-xs font-medium text-red-700">{errors.authorizationConfirmed}</p> : null}</div></div></section></div>;
}

type PinInputProps = {
  label: string;
  name: "pin" | "confirmPin";
  value: string;
  error?: string;
  visible: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onToggle: () => void;
};

function PinInput({ label, name, value, error, visible, onChange, onToggle }: PinInputProps) {
  const id = `business-${name}`;
  return <div><label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label} <span className="text-star-700" aria-hidden="true">*</span></label><div className="relative"><input id={id} name={name} type={visible ? "text" : "password"} inputMode="numeric" autoComplete="new-password" maxLength={6} value={value} onChange={onChange} required aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 pr-11 text-sm text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} /><button type="button" onClick={onToggle} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-star-muted transition hover:bg-star-50 hover:text-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">{visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}</button></div>{error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}</div>;
}
