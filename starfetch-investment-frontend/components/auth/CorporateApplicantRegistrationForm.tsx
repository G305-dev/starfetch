"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { getSafeErrorMessage, registerCorporateApplicant } from "@/lib/api/client";
import { setPendingVerification } from "@/lib/auth/verification-flow";

type CorporateRegistrationErrors = { email?: string; password?: string; confirmPassword?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minimumPasswordLength = 8;
const maximumPasswordLength = 128;

function inputClassName(hasError: boolean) {
  return `h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 disabled:cursor-not-allowed disabled:bg-star-50 ${hasError ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`;
}

export function CorporateApplicantRegistrationForm() {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<CorporateRegistrationErrors>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const nextErrors: CorporateRegistrationErrors = {};
    if (!email) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter a password.";
    else if (password.length < minimumPasswordLength) nextErrors.password = "Password must be at least 8 characters.";
    else if (password.length > maximumPasswordLength) nextErrors.password = "Password must be no more than 128 characters.";
    if (!confirmPassword) nextErrors.confirmPassword = "Confirm your password.";
    else if (password && password !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      // The canonical Corporate body is exactly registrationType, email and password.
      // confirmPassword is intentionally frontend-only and is never transmitted.
      const result = await registerCorporateApplicant({ email, password });
      setPendingVerification({ verificationId: result.verificationId, maskedEmail: result.maskedEmail, registrationType: "CORPORATE" });
      router.push("/register/corporate/verify-email");
    } catch (error) {
      setServerError(getSafeErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="mx-auto w-full max-w-2xl"><div className="text-center"><p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Corporate applicant</p><h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Create your Corporate login</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted">Create the secure applicant login for your Corporate application. You will verify your email before you can sign in and prepare a Corporate DRAFT.</p><div className="mx-auto mt-6 w-full max-w-[210px]" aria-label="Step 2 of 4"><p className="text-xs font-bold text-star-700">Step 2 of 4</p><div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map((step) => <span key={step} className={`h-1.5 rounded-full ${step <= 1 ? "w-8 bg-star-lime" : "w-1.5 bg-star-200"}`} />)}</div></div></div><form noValidate onSubmit={handleSubmit} className="mt-9 rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:p-8"><div><label htmlFor={emailId} className="mb-2 block text-sm font-bold text-star-900">Email address</label><input id={emailId} name="email" type="email" autoComplete="email" placeholder="applicant@company.com" disabled={submitting} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${emailId}-error` : undefined} className={inputClassName(Boolean(errors.email))} />{errors.email ? <p id={`${emailId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.email}</p> : null}</div><div className="mt-5 grid gap-5 sm:grid-cols-2"><PasswordField id={passwordId} label="Password" name="password" placeholder="Create a password" error={errors.password} showPassword={showPassword} disabled={submitting} onToggle={() => setShowPassword((current) => !current)} hint="Use at least 8 characters." /><PasswordField id={confirmPasswordId} label="Confirm password" name="confirmPassword" placeholder="Confirm your password" error={errors.confirmPassword} showPassword={showConfirmPassword} disabled={submitting} onToggle={() => setShowConfirmPassword((current) => !current)} /></div>{serverError ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">{serverError}</p> : null}<button type="submit" disabled={submitting} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Creating Corporate login…</> : "Continue to email verification"}</button></form></section>;
}

function PasswordField({ id, label, hint, name, placeholder, error, showPassword, disabled, onToggle }: { id: string; label: string; hint?: string; name: string; placeholder: string; error?: string; showPassword: boolean; disabled: boolean; onToggle: () => void }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label}</label>{hint ? <p className="-mt-1 mb-2 text-xs leading-5 text-star-muted">{hint}</p> : null}<div className="relative"><input id={id} name={name} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={placeholder} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`${inputClassName(Boolean(error))} pr-12`} /><button type="button" onClick={onToggle} disabled={disabled} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-star-700 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label={showPassword ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>{error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}</div>;
}
