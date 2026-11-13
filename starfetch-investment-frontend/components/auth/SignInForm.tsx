"use client";

import { Building2, Eye, EyeOff, LoaderCircle, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { getSafeErrorMessage, isApiError } from "@/lib/api/client";
import { getSafeReturnPath } from "@/lib/auth/safe-return-path";
import { setPendingVerification } from "@/lib/auth/verification-flow";
import { useAuth } from "./AuthProvider";

type LoginAccountType = "individual" | "joint" | "business" | "corporate";
type SignInErrors = {
  accountType?: string;
  rcNumber?: string;
  email?: string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountTypes: Array<{ id: Exclude<LoginAccountType, "corporate">; label: string; icon: typeof UserRound }> = [
  { id: "individual", label: "Individual", icon: UserRound },
  { id: "joint", label: "Joint", icon: Users },
  { id: "business", label: "Business", icon: Building2 },
];

const corporateApplicantLoginType = { id: "corporate" as const, label: "Corporate applicant", icon: Building2 };

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const rcNumberId = useId();
  const emailId = useId();
  const passwordId = useId();
  const accountTypeErrorId = useId();
  const safeNextPath = getSafeReturnPath(searchParams.get("next"));
  // Both the current dashboard route and legacy Corporate registration return
  // path select the existing INVESTOR login for a Corporate applicant.
  const corporateApplicantLogin = safeNextPath === "/corporate/dashboard" || safeNextPath === "/register/corporate";
  const [accountType, setAccountType] = useState<LoginAccountType | null>(corporateApplicantLogin ? "corporate" : null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignInErrors>({});
  const [notice, setNotice] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const availableAccountTypes = corporateApplicantLogin ? [corporateApplicantLoginType] : accountTypes;

  function selectAccountType(type: LoginAccountType) {
    setAccountType(type);
    setErrors((current) => ({ ...current, accountType: undefined, rcNumber: undefined }));
    setServerError("");
    setNotice(type === "business" ? "Business account login is not yet connected to the backend." : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    const rcNumber = String(data.get("rcNumber") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const nextErrors: SignInErrors = {};

    if (!accountType) nextErrors.accountType = "Select your account type before logging in.";
    if (accountType === "business" && !rcNumber) nextErrors.rcNumber = "Enter your business RC number.";
    if (!email) nextErrors.email = "Enter your email address.";
    else if (!emailPattern.test(email)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";

    setErrors(nextErrors);
    setNotice("");
    setServerError("");
    if (Object.keys(nextErrors).length > 0 || !accountType) return;

    if (accountType === "business") {
      setNotice("Business account login is not yet connected. No details were sent to the backend.");
      return;
    }

    setSubmitting(true);
    try {
      // Joint holders use the same verified INVESTOR authentication flow.
      await login({ email, password });
      const defaultDestination = accountType === "joint" ? "/joint/dashboard" : accountType === "corporate" ? "/corporate/dashboard" : "/dashboard";
      // `next` is untrusted query input. Only a validated same-origin app path
      // can override the account-type default after a successful login. The
      // legacy Corporate registration return path is normalised directly to
      // the protected dashboard so O2 is never entered after authentication.
      router.replace(corporateApplicantLogin ? "/corporate/dashboard" : safeNextPath ?? defaultDestination);
    } catch (requestError) {
      if (isApiError(requestError) && requestError.code === "EMAIL_NOT_VERIFIED" && requestError.verificationId) {
        const registrationType = corporateApplicantLogin ? "CORPORATE" : "INDIVIDUAL";
        setPendingVerification({ verificationId: requestError.verificationId, maskedEmail: requestError.maskedEmail ?? email, registrationType });
        router.push(registrationType === "CORPORATE" ? "/register/corporate/verify-email" : "/register/individual/verify-email");
        return;
      }
      setServerError(getSafeErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting;
  return <div className="rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:p-8 lg:p-10"><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-star-700">Investor portal</p><h2 className="mt-3 font-display text-[clamp(1.7rem,2.5vw,2.15rem)] font-bold tracking-[-0.04em] text-star-900">Log in</h2><p className="mt-2 text-sm leading-6 text-star-muted">{corporateApplicantLogin ? "Sign in with the verified Corporate applicant login you created. Corporate applicants use the existing Investor authentication service; there is no separate Business login." : "Select your account type, then use your Starfetch Investor Portal details to continue."}</p></div><form noValidate onSubmit={handleSubmit} className="mt-7 grid gap-5"><fieldset aria-describedby={errors.accountType ? accountTypeErrorId : undefined}><legend className="text-sm font-bold text-star-900">Account Type</legend><p className="mt-1 text-xs leading-5 text-star-muted">{corporateApplicantLogin ? "This secure sign-in is for the Corporate applicant dashboard. Selecting it controls this screen only; the backend authenticates the existing INVESTOR role." : "Individual and Joint holders use the same secure Investor sign-in. Business login is not available here yet."}</p><div className={`mt-3 grid grid-cols-1 gap-2 ${corporateApplicantLogin ? "sm:grid-cols-1" : "sm:grid-cols-3"}`}>{availableAccountTypes.map(({ id, label, icon: Icon }) => { const selected = accountType === id; return <button key={id} type="button" onClick={() => selectAccountType(id)} disabled={disabled} aria-pressed={selected} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-star-700 bg-star-100 text-star-900" : "border-star-200 bg-white text-star-700 hover:border-star-300 hover:bg-star-50"}`}><Icon size={18} aria-hidden="true" />{label}</button>; })}</div>{errors.accountType ? <p id={accountTypeErrorId} className="mt-2 text-xs font-medium text-red-700">{errors.accountType}</p> : null}</fieldset>{accountType === "business" ? <div><label htmlFor={rcNumberId} className="mb-2 block text-sm font-bold text-star-900">RC Number</label><input id={rcNumberId} name="rcNumber" type="text" autoComplete="off" placeholder="Enter your business RC number" disabled={disabled} aria-invalid={Boolean(errors.rcNumber)} aria-describedby={errors.rcNumber ? `${rcNumberId}-error` : undefined} className={inputClassName(Boolean(errors.rcNumber))} />{errors.rcNumber ? <p id={`${rcNumberId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.rcNumber}</p> : null}</div> : null}<div><label htmlFor={emailId} className="mb-2 block text-sm font-bold text-star-900">Email Address</label><input id={emailId} name="email" type="email" autoComplete="email" placeholder="you@example.com" disabled={disabled} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${emailId}-error` : undefined} className={inputClassName(Boolean(errors.email))} />{errors.email ? <p id={`${emailId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.email}</p> : null}</div><div><label htmlFor={passwordId} className="mb-2 block text-sm font-bold text-star-900">Password</label><div className="relative"><input id={passwordId} name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" disabled={disabled} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${passwordId}-error` : undefined} className={`${inputClassName(Boolean(errors.password))} pr-12`} /><button type="button" onClick={() => setShowPassword((current) => !current)} disabled={disabled} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-star-700 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>{errors.password ? <p id={`${passwordId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.password}</p> : null}</div><div className="flex justify-end"><span className="text-sm text-star-muted">Password reset is not available yet.</span></div><button type="submit" disabled={disabled} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Logging in…</> : accountType === "corporate" ? "Log In to Corporate Applicant Dashboard" : accountType === "joint" ? "Log In to Joint Accounts" : accountType === "business" ? "Business login unavailable" : "Log In"}</button>{serverError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-center text-xs leading-5 text-red-700">{serverError}</p> : null}{notice ? <p role="status" className="rounded-lg bg-star-50 px-3.5 py-3 text-center text-xs leading-5 text-star-700">{notice}</p> : null}</form><p className="mt-7 text-center text-sm text-star-muted lg:hidden">Don&apos;t have an account? <Link href="/open-account" className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-4 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Open an account</Link></p></div>;
}

function inputClassName(hasError: boolean) {
  return `h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 disabled:cursor-not-allowed disabled:bg-star-50 ${hasError ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`;
}
