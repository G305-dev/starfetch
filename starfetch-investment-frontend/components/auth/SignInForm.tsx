"use client";

import { Building2, Eye, EyeOff, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";

type LoginAccountType = "individual" | "joint" | "business";
type SignInErrors = {
  accountType?: string;
  rcNumber?: string;
  email?: string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountTypes: Array<{ id: LoginAccountType; label: string; icon: typeof UserRound }> = [
  { id: "individual", label: "Individual", icon: UserRound },
  { id: "joint", label: "Joint", icon: Users },
  { id: "business", label: "Business", icon: Building2 },
];

export function SignInForm() {
  const rcNumberId = useId();
  const emailId = useId();
  const passwordId = useId();
  const accountTypeErrorId = useId();
  const [accountType, setAccountType] = useState<LoginAccountType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignInErrors>({});
  const [notice, setNotice] = useState("");

  function selectAccountType(type: LoginAccountType) {
    setAccountType(type);
    setErrors((current) => ({ ...current, accountType: undefined, rcNumber: undefined }));
    setNotice("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    if (Object.keys(nextErrors).length === 0 && accountType) {
      setNotice(`${accountType[0].toUpperCase()}${accountType.slice(1)} sign-in is not connected yet. Your details have not been submitted.`);
    }
  }

  return <div className="rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:p-8 lg:p-10"><div><p className="text-[0.64rem] font-extrabold uppercase tracking-[0.18em] text-star-700">Investor portal</p><h2 className="mt-3 font-display text-[clamp(1.7rem,2.5vw,2.15rem)] font-bold tracking-[-0.04em] text-star-900">Log in</h2><p className="mt-2 text-sm leading-6 text-star-muted">Select your account type, then use your Starfetch Investor Portal details to continue.</p></div><form noValidate onSubmit={handleSubmit} className="mt-7 grid gap-5"><fieldset aria-describedby={errors.accountType ? accountTypeErrorId : undefined}><legend className="text-sm font-bold text-star-900">Account Type</legend><p className="mt-1 text-xs leading-5 text-star-muted">Choose the account you are logging in to.</p><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{accountTypes.map(({ id, label, icon: Icon }) => { const selected = accountType === id; return <button key={id} type="button" onClick={() => selectAccountType(id)} aria-pressed={selected} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 ${selected ? "border-star-700 bg-star-100 text-star-900" : "border-star-200 bg-white text-star-700 hover:border-star-300 hover:bg-star-50"}`}><Icon size={18} aria-hidden="true" />{label}</button>; })}</div>{errors.accountType ? <p id={accountTypeErrorId} className="mt-2 text-xs font-medium text-red-700">{errors.accountType}</p> : null}</fieldset>{accountType === "business" ? <div><label htmlFor={rcNumberId} className="mb-2 block text-sm font-bold text-star-900">RC Number</label><input id={rcNumberId} name="rcNumber" type="text" autoComplete="off" placeholder="Enter your business RC number" aria-invalid={Boolean(errors.rcNumber)} aria-describedby={errors.rcNumber ? `${rcNumberId}-error` : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${errors.rcNumber ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} />{errors.rcNumber ? <p id={`${rcNumberId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.rcNumber}</p> : null}</div> : null}<div><label htmlFor={emailId} className="mb-2 block text-sm font-bold text-star-900">Email Address</label><input id={emailId} name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? `${emailId}-error` : undefined} className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${errors.email ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} />{errors.email ? <p id={`${emailId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.email}</p> : null}</div><div><label htmlFor={passwordId} className="mb-2 block text-sm font-bold text-star-900">Password</label><div className="relative"><input id={passwordId} name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? `${passwordId}-error` : undefined} className={`h-12 w-full rounded-lg border bg-white py-0 pl-3.5 pr-12 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${errors.password ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-star-700 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div>{errors.password ? <p id={`${passwordId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.password}</p> : null}</div><div className="flex justify-end"><Link href="/forgot-password" className="text-sm font-bold text-star-700 no-underline transition hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Forgot password?</Link></div><button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0">Log In</button>{notice ? <p role="status" className="rounded-lg bg-star-50 px-3.5 py-3 text-center text-xs leading-5 text-star-700">{notice}</p> : null}</form><p className="mt-7 text-center text-sm text-star-muted lg:hidden">Don&apos;t have an account? <Link href="/open-account" className="font-bold text-star-700 underline decoration-star-lime decoration-2 underline-offset-4 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Open an account</Link></p></div>;
}
