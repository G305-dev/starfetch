"use client";

import Link from "next/link";
import { LoaderCircle, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";
import { getSafeErrorMessage, isApiError, resendVerificationEmail, verifyEmail } from "@/lib/api/client";
import { getPendingVerification, markVerificationSucceeded } from "@/lib/auth/verification-flow";

export function EmailVerificationForm() {
  const router = useRouter();
  const verificationCodeId = useId();
  const [verification, setVerification] = useState<ReturnType<typeof getPendingVerification>>(null);
  const [initialising, setInitialising] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setVerification(getPendingVerification());
    setInitialising(false);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifying || !verification) return;
    const code = String(new FormData(event.currentTarget).get("verificationCode") || "").trim();
    setNotice("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit verification code.");
      return;
    }

    setError("");
    setVerifying(true);
    try {
      const result = await verifyEmail({ verificationId: verification.verificationId, code });
      markVerificationSucceeded(result.maskedEmail ?? verification.maskedEmail, verification.registrationType);
      router.push(verification.registrationType === "CORPORATE" ? "/register/corporate/verify-email/success" : "/register/individual/verify-email/success");
    } catch (requestError) {
      setError(getSafeErrorMessage(requestError));
    } finally {
      setVerifying(false);
    }
  }

  async function resendCode() {
    if (resending || cooldown > 0 || !verification) return;
    setError("");
    setNotice("");
    setResending(true);
    try {
      const result = await resendVerificationEmail({ verificationId: verification.verificationId });
      if (result.maskedEmail) setVerification((current) => current ? { ...current, maskedEmail: result.maskedEmail! } : current);
      if (result.cooldownSeconds && result.cooldownSeconds > 0) setCooldown(result.cooldownSeconds);
      setNotice("A new verification code has been requested. Please check your inbox.");
    } catch (requestError) {
      if (isApiError(requestError) && requestError.retryAfterSeconds) setCooldown(requestError.retryAfterSeconds);
      setError(getSafeErrorMessage(requestError));
    } finally {
      setResending(false);
    }
  }

  if (initialising) return <section className="mx-auto grid min-h-[360px] w-full max-w-xl place-items-center text-center"><div><LoaderCircle size={30} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Preparing verification…</p></div></section>;

  if (!verification) return <section className="mx-auto w-full max-w-xl text-center"><div className="rounded-2xl border border-star-200 bg-white p-7 shadow-card sm:p-10"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-star-100 text-star-700"><MailCheck size={28} strokeWidth={1.9} aria-hidden="true" /></div><h1 className="mt-6 font-display text-2xl font-bold tracking-[-0.04em] text-star-900">Start email verification</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-star-muted">Create an account first so we can securely verify the code for your email address.</p><Link href="/open-account" className="mt-7 inline-flex min-h-11 items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 no-underline transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Choose an account type</Link></div></section>;

  const isCorporateRegistration = verification.registrationType === "CORPORATE";
  const applicantLabel = isCorporateRegistration ? "Corporate applicant" : "Individual account";
  return <section className="mx-auto w-full max-w-xl text-center">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-star-100 text-star-700"><MailCheck size={28} strokeWidth={1.9} aria-hidden="true" /></div>
    <p className="mt-6 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">{applicantLabel}</p>
    <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Verify your email</h1>
    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-star-muted">Enter the six-digit code sent to <strong className="font-extrabold text-star-900">{verification.maskedEmail}</strong>. The code is checked securely with Starfetch before you can {isCorporateRegistration ? "sign in to continue your Corporate application." : "continue."}</p>
    <div className="mx-auto mt-6 w-full max-w-[210px]" aria-label="Step 3 of 4"><p className="text-xs font-bold text-star-700">Step 3 of 4</p><div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map((step) => <span key={step} className={`h-1.5 rounded-full ${step <= 2 ? "w-8 bg-star-lime" : "w-1.5 bg-star-200"}`} />)}</div></div>

    <form noValidate onSubmit={handleSubmit} className="mt-9 rounded-2xl border border-star-200 bg-white p-6 text-left shadow-card sm:p-8">
      <label htmlFor={verificationCodeId} className="mb-2 block text-sm font-bold text-star-900">Verification code</label>
      <input id={verificationCodeId} name="verificationCode" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={verifying} placeholder="000000" aria-invalid={Boolean(error)} aria-describedby={error ? `${verificationCodeId}-error` : undefined} className={`h-14 w-full rounded-lg border bg-white px-4 text-center font-display text-xl font-bold tracking-[0.45em] text-star-900 outline-none transition placeholder:tracking-[0.3em] placeholder:text-star-muted/60 focus:border-star-700 focus:ring-2 focus:ring-star-100 disabled:cursor-not-allowed disabled:bg-star-50 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`} />
      {error ? <p id={`${verificationCodeId}-error`} role="alert" className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      <button type="submit" disabled={verifying} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">{verifying ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Verifying…</> : "Verify email"}</button>
      {notice ? <p role="status" className="mt-4 rounded-lg bg-star-50 px-4 py-3 text-center text-xs leading-5 text-star-700">{notice}</p> : null}
      <div className="mt-6 text-center text-sm text-star-muted"><button type="button" onClick={resendCode} disabled={resending || cooldown > 0} className="font-bold text-star-700 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:text-star-muted">{resending ? "Requesting a new code…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend code"}</button></div>
    </form>
  </section>;
}
