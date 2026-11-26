"use client";

/**
 * ADMIN MFA CHALLENGE — the second step of staff sign-in.
 *
 * This component exists because the previous flow treated a successful password
 * POST as a completed sign-in and redirected to `/admin/dashboard`. That is a
 * one-factor portal wearing the clothes of a two-factor one. Here the password
 * step hands off to a challenge that must be verified by the backend before any
 * session exists.
 *
 * Three rules are structural rather than advisory:
 *
 *   1. No session is established here. The browser never sets the staff cookie;
 *      only the BFF's `mfa-verify` and `mfa-recovery` actions may, and only after
 *      the backend confirms. This component cannot mark anyone as signed in.
 *   2. It renders no secret. No `otpauth://` URI, no base32 string, no QR image is
 *      produced client-side. The enrolment view shows where the backend payload
 *      *will* appear and states that it is absent.
 *   3. Shape checks are not verification. A six-digit code typing correctly says
 *      nothing about whether it is right.
 *
 * All controls are inert while the backend contract is unapproved.
 */

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Fingerprint,
  KeyRound,
  Lock,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import {
  CHALLENGE_TTL_SECONDS,
  MFA_INTEGRATION_NOTE,
  attemptsRemaining,
  canAttemptVerification,
  challengeClock,
  methodsForStep,
  stepMessage,
  type LoginStep,
} from "@/lib/admin/mfa";
import { mfaMethodLabel, type MfaMethod } from "@/lib/admin/prepared";
import { button, input, secondary } from "@/components/admin/live/UI";



const METHOD_ICONS: Record<MfaMethod, typeof KeyRound> = {
  passkey: Fingerprint,
  "security-key": KeyRound,
  totp: ShieldCheck,
  "recovery-code": QrCode,
};

export function AdminMfaChallenge({
  step,
  enabled,
  challengeExpiresAt = null,
  methods,
  attempts = 0,
  onVerified,
  onCancel,
}: {
  /** Which challenge step is active. Never `credentials` or `authenticated`. */
  step: LoginStep;
  /** Whether the backend contract is live. When false every control is inert. */
  enabled: boolean;
  /** Backend-supplied expiry. `null` means the backend has not said — shown as unknown. */
  challengeExpiresAt?: string | null;
  methods?: readonly MfaMethod[] | undefined;
  /** Failed attempts so far, from the backend. */
  attempts?: number;
  /** Called only after the BFF reports a backend-confirmed session. */
  onVerified: () => void;
  /** Abandon the challenge. Returns to the password step; issues nothing. */
  onCancel: () => void;
}) {
  const copy = stepMessage(step);
  const offered = useMemo(() => {
    const allowed = methodsForStep(step);
    // Backend-supplied methods narrow the offer; absent that, the step's default
    // set is used. Filtered by the step, so a backend cannot talk the UI into
    // offering a method it does not support at this stage.
    const requested = methods && methods.length > 0 ? methods : allowed;
    return requested.filter((m) => allowed.includes(m));
  }, [methods, step]);

  const [method, setMethod] = useState<MfaMethod | "">(offered[0] ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const [nowIso, setNowIso] = useState("");
  useEffect(() => {
    const updateClock = () => setNowIso(new Date().toISOString());
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);
  const clock = challengeClock(challengeExpiresAt, nowIso);
  const remaining = attemptsRemaining(attempts);
  const readiness = canAttemptVerification({ method, code });
  const isEnrolment = step === "mfa-enrolment-required";

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // This deliberately does nothing. There is no approved contract to call, and a
    // local success here would be indistinguishable from a real one on screen.
    if (!enabled) return;
    setError(
      "Verification is not connected. The backend must implement and approve the MFA contract before a session can be issued.",
    );
  }

  return (
    <div className="w-full max-w-[460px] rounded-2xl border border-[#e6ece6] bg-white p-6 shadow-card sm:p-8">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-lg bg-star-100 p-2 text-star-900" aria-hidden="true">
          {isEnrolment ? <ShieldCheck size={18} /> : <Lock size={18} />}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-star-900">{copy.title}</h1>
          <p className="mt-1 text-xs leading-5 text-star-muted">{copy.body}</p>
        </div>
      </div>

      {/* Step indicator: makes the two factors visibly two steps. */}
      <ol className="mt-5 flex items-center gap-2 text-[10px] font-extrabold tracking-wide" aria-label="Sign-in progress">
        <li className="flex items-center gap-1.5 text-star-900">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-star-900 text-white">1</span>
          PASSWORD
        </li>
        <li className="h-px w-6 bg-star-300" aria-hidden="true" />
        <li className="flex items-center gap-1.5 text-amber-800" aria-current="step">
          <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-amber-600 bg-white text-amber-800">2</span>
          SECOND FACTOR
        </li>
        <li className="h-px w-6 bg-star-300" aria-hidden="true" />
        <li className="flex items-center gap-1.5 text-star-muted/70">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-star-300 bg-white">3</span>
          SESSION
        </li>
      </ol>

      {!enabled && (
        <p role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
          {MFA_INTEGRATION_NOTE} No session will be created until this contract is approved and implemented.
        </p>
      )}

      {clock.state === "expiring" && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <Clock size={14} aria-hidden="true" /> Verification closes in {clock.secondsRemaining}s. Finish now or start again.
        </p>
      )}

      {clock.state === "unknown" && (
        <p role="status" className="mt-4 rounded-lg border border-[#e7ece7] bg-[#f8faf7] px-3 py-2 text-[11px] leading-4 text-star-muted">
          The backend has not supplied a challenge expiry. The window is limited to {Math.round(CHALLENGE_TTL_SECONDS / 60)} minutes,
          but this screen will not show a countdown it cannot substantiate.
        </p>
      )}

      {step === "mfa-expired" || step === "mfa-locked" ? (
        <div className="mt-5 space-y-3">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] leading-5 text-red-900">
            {step === "mfa-locked"
              ? "This challenge is locked after repeated failures. No session was issued."
              : "The verification window closed. No session was issued."}
          </p>
          <button type="button" className={button + " w-full"} onClick={onCancel} disabled={!enabled}>
            <ArrowLeft size={15} aria-hidden="true" /> Start sign-in again
          </button>
          <button type="button" className={secondary + " w-full"} onClick={onCancel} disabled={!enabled}>
            Cancel and sign out
          </button>
        </div>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <fieldset>
            <legend className="mb-1 block text-xs font-bold text-star-900">Verification method</legend>
            <div className="space-y-1.5">
              {offered.map((option) => {
                const Icon = METHOD_ICONS[option];
                const selected = method === option;
                return (
                  <label
                    key={option}
                    className={
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold " +
                      (selected ? "border-star-900 bg-star-50 text-star-900" : "border-[#e7ece7] text-star-900 hover:bg-star-50/50")
                    }
                  >
                    <input
                      type="radio"
                      name="mfa-method"
                      className="h-3.5 w-3.5"
                      checked={selected}
                      disabled={!enabled}
                      onChange={() => {
                        setMethod(option);
                        setCode("");
                        setError("");
                      }}
                    />
                    <Icon size={15} aria-hidden="true" className="text-star-muted" />
                    {mfaMethodLabel(option)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {isEnrolment && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3">
              <p className="flex items-center gap-2 text-[11px] font-extrabold text-amber-900">
                <QrCode size={14} aria-hidden="true" /> Provisioning payload
              </p>
              <p className="mt-1 text-[11px] leading-4 text-amber-900">
                The enrolment secret is generated and stored by the backend. Nothing is drawn here, because a secret
                rendered in the browser is not a secret. This area fills only from a backend payload.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold text-star-900" htmlFor="mfa-code">
              {method === "recovery-code" ? "Recovery code" : "Six-digit code"}
            </label>
            <input
              id="mfa-code"
              className={input}
              type="text"
              inputMode={method === "recovery-code" ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={method === "recovery-code" ? 32 : 6}
              value={code}
              disabled={!enabled}
              onChange={(e) => {
                setCode(
                  method === "recovery-code"
                    ? e.target.value
                    : e.target.value.replace(/\D/g, "").slice(0, 6),
                );
                setError("");
              }}
              placeholder={method === "recovery-code" ? "Your saved recovery code" : "000000"}
            />
            {!readiness.enabled && code.length > 0 && (
              <span className="mt-1 block text-[11px] text-amber-800">{readiness.reason}</span>
            )}
          </div>

          {remaining <= 2 && (
            <p className="text-[11px] font-semibold text-red-800">
              {remaining === 0 ? "No attempts remain." : `${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`}
            </p>
          )}

          {error && (
            <p role="alert" className="text-xs font-semibold text-red-700">
              {error}
            </p>
          )}

          <button type="submit" className={button + " w-full"} disabled={!enabled || !readiness.enabled}>
            <CheckCircle2 size={15} aria-hidden="true" />
            {isEnrolment ? "Confirm and continue" : "Verify and continue"}
          </button>

          <button type="button" className={secondary + " w-full"} onClick={onCancel} disabled={!enabled}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to sign in
          </button>
        </form>
      )}

      <p className="mt-5 flex items-start gap-2 border-t border-star-200 pt-4 text-[11px] leading-4 text-star-muted">
        <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          Your password was accepted, but it is one factor. No staff session, permission set or portal access exists
          until the second factor is verified by the backend.
        </span>
      </p>
    </div>
  );
}
