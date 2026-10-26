"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

export function EmailVerificationForm() {
  const router = useRouter();
  const verificationCodeId = useId();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const verificationCode = String(data.get("verificationCode") || "").trim();

    setNotice("");
    if (!verificationCode) {
      setError("Enter your verification code.");
      return;
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setError("Enter the six-digit verification code.");
      return;
    }

    setError("");
    router.push("/register/individual/verify-email/success");
  }

  return (
    <section className="mx-auto w-full max-w-xl text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-star-100 text-star-700">
        <MailCheck size={28} strokeWidth={1.9} aria-hidden="true" />
      </div>
      <p className="mt-6 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Individual account</p>
      <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Verify your email</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-star-muted">
        Email verification is the next step in opening your Individual Account. Enter the six-digit verification code when this step is connected to the approved email-verification service.
      </p>

      <div className="mx-auto mt-6 w-full max-w-[210px]" aria-label="Step 3 of 4">
        <p className="text-xs font-bold text-star-700">Step 3 of 4</p>
        <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((step) => (
            <span key={step} className={`h-1.5 rounded-full ${step <= 2 ? "w-8 bg-star-lime" : "w-1.5 bg-star-200"}`} />
          ))}
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} className="mt-9 rounded-2xl border border-star-200 bg-white p-6 text-left shadow-card sm:p-8">
        <label htmlFor={verificationCodeId} className="mb-2 block text-sm font-bold text-star-900">Verification code</label>
        <input
          id={verificationCodeId}
          name="verificationCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${verificationCodeId}-error` : undefined}
          className={`h-14 w-full rounded-lg border bg-white px-4 text-center font-display text-xl font-bold tracking-[0.45em] text-star-900 outline-none transition placeholder:tracking-[0.3em] placeholder:text-star-muted/60 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`}
        />
        {error ? <p id={`${verificationCodeId}-error`} className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}

        <button
          type="submit"
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0"
        >
          Verify email
        </button>
        {notice ? <p role="status" className="mt-4 rounded-lg bg-star-50 px-4 py-3 text-center text-xs leading-5 text-star-700">{notice}</p> : null}

        <div className="mt-6 text-center text-sm text-star-muted">
          <button
            type="button"
            onClick={() => setNotice("Resending an email is not connected in this frontend mockup.")}
            className="font-bold text-star-700 transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Resend code
          </button>
        </div>
      </form>
    </section>
  );
}
