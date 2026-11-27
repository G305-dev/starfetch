"use client";

/**
 * STAFF SECURITY — prepared interface.
 *
 * MFA enrolment, verification, recovery codes, session expiry and
 * reauthentication. Brief requirement 5.
 *
 * The most important property of this file: **it never generates a secret and
 * never validates a credential**. A TOTP secret produced in the browser is not a
 * secret — the browser already knows it. Every check here is a *shape* check so
 * the form can be usable; the value goes to the backend, which decides.
 *
 * Nothing in this component can put a staff member into an authenticated state.
 * That is not a frontend decision, and pretending otherwise would be the exact
 * failure mode the brief warns about.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Timer,
} from "lucide-react";
import {
  ABSOLUTE_SESSION_HOURS,
  ENROLMENT_STEPS,
  INACTIVITY_TIMEOUT_MINUTES,
  MFA_METHODS,
  enrolmentComplete,
  enrolmentStepLabel,
  isValidRecoveryShape,
  isValidReauthShape,
  isValidTotpShape,
  mfaMethodLabel,
  nextEnrolmentStep,
  sessionClock,
  type ContractState,
  type EnrolmentStep,
  type MfaMethod,
} from "@/lib/admin/prepared";
import {
  Card,
  FieldGrid,
  InertNote,
  IntegrationBadge,
  PreparedAction,
  SectionHeading,
  StatusPill,
  SubTabs,
  TabPanel,
  button,
  input,
  secondary,
} from "./UI";

const NOW = "2026-11-17T09:00:00.000Z";

const TABS = [
  { key: "enrolment", label: "Enrolment" },
  { key: "verify", label: "Verification" },
  { key: "recovery", label: "Recovery codes" },
  { key: "session", label: "Session" },
  { key: "reauth", label: "Reauthentication" },
] as const;

export function StaffSecurity({ contract }: { contract: ContractState }) {
  const [active, setActive] = useState<string>("enrolment");
  return (
    <div className="space-y-4">
      <Card>
        <SectionHeading
          title="Staff security"
          description="Second-factor enrolment, verification, recovery and session controls. Every one of these operations is performed by the backend; this screen prepares the workflow."
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <IntegrationBadge />
          <StatusPill tone="caution">MFA not yet available</StatusPill>
          <StatusPill tone="neutral">
            {INACTIVITY_TIMEOUT_MINUTES}-minute inactivity · {ABSOLUTE_SESSION_HOURS}-hour absolute
          </StatusPill>
        </div>
        {/* Stated once, at the top, because it is true of every screen below:
            no secret is ever produced in the browser and no credential is ever
            checked here. */}
        <p className="mt-3 rounded-lg border border-star-200 bg-star-50 p-3 text-[11px] leading-4 text-star-900">
          <strong className="font-extrabold">Nothing on this page authenticates you.</strong> The secret is
          generated and stored by the backend, and every credential is verified by the backend. This screen never
          generates a secret, never validates a code and never creates a session.
        </p>
      </Card>

      <SubTabs tabs={TABS.map((t) => ({ ...t }))} active={active} onChange={setActive} />

      <TabPanel id="enrolment" active={active}>
        <EnrolmentPanel contract={contract} />
      </TabPanel>
      <TabPanel id="verify" active={active}>
        <VerifyPanel contract={contract} />
      </TabPanel>
      <TabPanel id="recovery" active={active}>
        <RecoveryPanel contract={contract} />
      </TabPanel>
      <TabPanel id="session" active={active}>
        <SessionPanel />
      </TabPanel>
      <TabPanel id="reauth" active={active}>
        <ReauthPanel contract={contract} />
      </TabPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EnrolmentPanel({ contract }: { contract: ContractState }) {
  const [step, setStep] = useState<EnrolmentStep>("choose-method");
  const [method, setMethod] = useState<MfaMethod>("passkey");

  const completed = useMemo(
    () =>
      Object.fromEntries(ENROLMENT_STEPS.map((s) => [s, ENROLMENT_STEPS.indexOf(s) < ENROLMENT_STEPS.indexOf(step)])) as Record<
        EnrolmentStep,
        boolean
      >,
    [step],
  );
  const done = enrolmentComplete(completed);
  const next = nextEnrolmentStep(step);
  const progress = ((ENROLMENT_STEPS.indexOf(step) + 1) / ENROLMENT_STEPS.length) * 100;

  const METHOD_DETAIL: Record<MfaMethod, { icon: typeof Fingerprint; detail: string; recommended: boolean }> = {
    passkey: {
      icon: Fingerprint,
      detail: "Uses the device you already unlock — a fingerprint, face or screen lock. Resists phishing because it is bound to the admin hostname.",
      recommended: true,
    },
    "security-key": {
      icon: KeyRound,
      detail: "A physical USB or NFC key. Strongest option for shared workstations and operations roles.",
      recommended: false,
    },
    totp: {
      icon: Smartphone,
      detail: "A six-digit code from an authenticator app. Works without hardware, but is phishable.",
      recommended: false,
    },
    "recovery-code": {
      icon: RefreshCw,
      detail: "Break-glass only. Single use, issued once, and should be stored offline.",
      recommended: false,
    },
  };

  return (
    <>
      <Card>
        <SectionHeading
          title="Enrol a second factor"
          description="Enrolment is mandatory for every staff account. There is no skip: an account without a verified factor cannot complete sign-in."
        />
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#eef3ec]">
            <div className="h-full rounded-full bg-star-700 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {ENROLMENT_STEPS.map((s, index) => {
              const isDone = completed[s];
              const isCurrent = s === step;
              return (
                <li key={s} className="flex items-center gap-2 text-[11px]">
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold " +
                      (isDone ? "bg-star-700 text-white" : isCurrent ? "bg-star-100 text-star-900 ring-1 ring-star-500" : "bg-[#eef3ec] text-star-muted")
                    }
                  >
                    {isDone ? <Check size={9} /> : index + 1}
                  </span>
                  <span className={isCurrent ? "font-extrabold text-star-900" : "text-star-muted"}>{enrolmentStepLabel(s)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <Card>
        <SectionHeading title={enrolmentStepLabel(step)} description="Current step." />

        {step === "choose-method" && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {MFA_METHODS.map((candidate) => {
              const detail = METHOD_DETAIL[candidate];
              const selected = method === candidate;
              return (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setMethod(candidate)}
                  aria-pressed={selected}
                  className={
                    "rounded-lg border p-3 text-left transition " +
                    (selected ? "border-star-700 bg-star-50" : "border-[#e7ece7] bg-white hover:border-star-300")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <detail.icon size={15} aria-hidden="true" className="text-star-700" />
                      <p className="text-xs font-extrabold text-star-900">{mfaMethodLabel(candidate)}</p>
                    </div>
                    {detail.recommended && <StatusPill tone="positive">Recommended</StatusPill>}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-star-muted">{detail.detail}</p>
                </button>
              );
            })}
          </div>
        )}

        {step === "confirm-identity" && (
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-5 text-star-muted">
              Confirm your current password before registering a new factor. This prevents someone with a borrowed
              session from enrolling their own device.
            </p>
            <label className="block max-w-sm text-xs font-bold">
              Current password
              <input type="password" className={input + " mt-1"} autoComplete="current-password" placeholder="••••••••" />
            </label>
          </div>
        )}

        {step === "register-factor" && (
          <div className="mt-3">
            {method === "totp" ? (
              <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-star-300 bg-[#f8faf7]">
                  <div className="text-center">
                    <QrCode size={30} aria-hidden="true" className="mx-auto text-star-muted" />
                    <p className="mt-1 text-[10px] font-bold text-star-muted">QR code</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-star-900">Scan with your authenticator app</p>
                  <p className="mt-1 text-[11px] leading-4 text-star-muted">
                    The secret is generated and stored by the backend and shown once. This screen does not generate
                    it — a secret created in the browser is already known to the browser.
                  </p>
                  <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900">
                    The QR code appears here only when the backend returns the enrolment payload. Nothing is
                    displayed until then, because a placeholder code would be scanned and would not work.
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-star-300 bg-[#f8faf7] p-6 text-center">
                {method === "passkey" ? (
                  <Fingerprint size={26} aria-hidden="true" className="mx-auto text-star-muted" />
                ) : (
                  <KeyRound size={26} aria-hidden="true" className="mx-auto text-star-muted" />
                )}
                <p className="mt-2 text-xs font-bold text-star-900">
                  {method === "passkey" ? "Register this device" : "Insert your security key"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-[11px] leading-4 text-star-muted">
                  Registration uses the WebAuthn ceremony initiated by the backend. The browser prompt appears once
                  the challenge is issued.
                </p>
              </div>
            )}
          </div>
        )}

        {step === "verify-factor" && (
          <div className="mt-3 max-w-sm">
            <label className="block text-xs font-bold">
              Enter the code to confirm the factor works
              <input
                className={input + " mt-1 tracking-[0.3em]"}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                aria-label="Six digit code to verify the factor"
              />
              <span className="mt-1 block text-[11px] font-normal text-star-muted">
                Six digits. This checks the format only — the backend verifies the value.
              </span>
            </label>
          </div>
        )}

        {step === "recovery-codes" && (
          <div className="mt-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                <AlertTriangle size={13} aria-hidden="true" /> Shown once
              </p>
              <p className="mt-1 text-[11px] leading-4 text-amber-900">
                Ten single-use recovery codes are displayed exactly once at enrolment. Store them offline. Using one
                consumes it. They are never shown again and cannot be retrieved by support.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="rounded border border-dashed border-star-200 bg-[#f8faf7] px-2 py-2 text-center">
                  <span className="text-[10px] text-star-muted">code {index + 1}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-star-muted">
              Codes appear here once the backend issues them. Nothing is generated in the browser.
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-star-200 bg-star-50 p-3">
            <CheckCircle2 size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-star-700" />
            <div>
              <p className="text-xs font-extrabold text-star-900">Enrolment complete</p>
              <p className="mt-0.5 text-[11px] leading-4 text-star-muted">
                The factor is verified and available at next sign-in.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-[#e7ece7] pt-4">
          <button
            type="button"
            className={secondary}
            disabled={step === "choose-method"}
            onClick={() => {
              const index = ENROLMENT_STEPS.indexOf(step);
              if (index > 0) setStep(ENROLMENT_STEPS[index - 1]);
            }}
          >
            Back
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <PreparedAction contract={contract} disabled={next === null} onClick={() => next && setStep(next)}>
              {step === "recovery-codes" ? (
                <>
                  <Check size={14} aria-hidden="true" /> Finish enrolment
                </>
              ) : (
                "Continue"
              )}
            </PreparedAction>
          </div>
        </div>
        {done && (
          <p className="mt-2 text-[11px] font-bold text-star-700">
            All enrolment steps are complete.
          </p>
        )}
        <InertNote contract={contract} />
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function VerifyPanel({ contract }: { contract: ContractState }) {
  const [method, setMethod] = useState<MfaMethod>("totp");
  const [code, setCode] = useState("");

  const valid = method === "totp" ? isValidTotpShape(code) : method === "recovery-code" ? isValidRecoveryShape(code) : true;

  return (
    <Card>
      <SectionHeading
        title="Verify at sign-in"
        description="The step that issues a session. A correct password alone never does."
      />
      <div className="mt-4 max-w-md space-y-3">
        <label className="block text-xs font-bold">
          Method
          <select className={input + " mt-1"} value={method} onChange={(e) => setMethod(e.target.value as MfaMethod)}>
            {MFA_METHODS.filter((m) => m !== "recovery-code" || true).map((m) => (
              <option key={m} value={m}>
                {mfaMethodLabel(m)}
              </option>
            ))}
          </select>
        </label>

        {method === "totp" ? (
          <label className="block text-xs font-bold">
            Six-digit code
            <input
              className={input + " mt-1 max-w-[12rem] tracking-[0.3em]"}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Six digit authentication code"
            />
            <span className="mt-1 block text-[11px] font-normal text-star-muted">
              {code.length}/6 digits{code.length === 6 && !valid ? " · invalid format" : ""}
            </span>
          </label>
        ) : method === "recovery-code" ? (
          <label className="block text-xs font-bold">
            Recovery code
            <input
              className={input + " mt-1 font-mono"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="one-time-code"
              aria-label="Recovery code"
            />
            <span className="mt-1 block text-[11px] font-normal text-star-muted">
              Each code works once and is then consumed.
            </span>
          </label>
        ) : (
          <p className="rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3 text-[11px] leading-4 text-star-muted">
            {method === "passkey"
              ? "The browser prompts for your passkey once the backend issues a challenge."
              : "Connect your security key and touch it when prompted."}
          </p>
        )}

        <div className="rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3 text-[11px] leading-4 text-star-muted">
          <p className="font-extrabold text-star-900">What happens on success</p>
          <p className="mt-1">
            The backend sets a host-only <code className="rounded bg-white px-1">__Host-</code>-prefixed session
            cookie and returns the staff profile. The frontend never mints or inspects that cookie.
          </p>
        </div>

        <div className="flex justify-end">
          <PreparedAction contract={contract} disabled={!valid}>
            <ShieldCheck size={14} aria-hidden="true" /> Verify and sign in
          </PreparedAction>
        </div>
        <InertNote contract={contract} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function RecoveryPanel({ contract }: { contract: ContractState }) {
  return (
    <Card>
      <SectionHeading
        title="Recovery codes"
        description="Break-glass access when the primary factor is unavailable. Single use, issued in a batch, hashed at rest."
      />
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#e7ece7] p-3">
          <p className="text-xs font-extrabold text-star-900">Remaining codes</p>
          <p className="mt-2 text-2xl font-extrabold text-star-900">—</p>
          <p className="mt-0.5 text-[11px] text-star-muted">
            Shown as a dash rather than 10, because only the backend knows how many remain.
          </p>
        </div>
        <div className="rounded-lg border border-[#e7ece7] p-3">
          <p className="text-xs font-extrabold text-star-900">Regenerate a batch</p>
          <p className="mt-1 text-[11px] leading-4 text-star-muted">
            Issuing a new batch invalidates every existing code. It requires reauthentication and is recorded in the
            audit log.
          </p>
          <div className="mt-2">
            <PreparedAction contract={contract} variant="secondary">
              <RefreshCw size={13} aria-hidden="true" /> Regenerate codes
            </PreparedAction>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-900">
        Recovery codes are generated server-side and displayed once. This screen never creates one, because a code
        the browser generated is a code the browser knows.
      </div>
      <InertNote contract={contract} />
    </Card>
  );
}

// ---------------------------------------------------------------------------

function SessionPanel() {
  // Two illustrative clocks: a healthy session and one in the warning window.
  const samples = [
    { label: "Typical session", expiresAt: "2026-11-17T17:00:00.000Z" },
    { label: "Near expiry", expiresAt: "2026-11-17T09:03:00.000Z" },
    { label: "Expired", expiresAt: "2026-11-17T08:45:00.000Z" },
  ];

  return (
    <>
      <Card>
        <SectionHeading
          title="Session lifetime"
          description="The backend enforces both limits. These controls are a courtesy countdown so a staff member is not interrupted mid-task."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#e7ece7] p-3">
            <div className="flex items-center gap-2">
              <Timer size={15} aria-hidden="true" className="text-star-muted" />
              <p className="text-xs font-extrabold text-star-900">Inactivity timeout</p>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-star-900">{INACTIVITY_TIMEOUT_MINUTES} min</p>
            <p className="mt-0.5 text-[11px] text-star-muted">No request for this long ends the session.</p>
          </div>
          <div className="rounded-lg border border-[#e7ece7] p-3">
            <div className="flex items-center gap-2">
              <Lock size={15} aria-hidden="true" className="text-star-muted" />
              <p className="text-xs font-extrabold text-star-900">Absolute lifetime</p>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-star-900">{ABSOLUTE_SESSION_HOURS} h</p>
            <p className="mt-0.5 text-[11px] text-star-muted">Reauthentication is required after this, regardless of activity.</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-extrabold text-star-900">Expiry warning states</p>
          <p className="mt-1 text-[11px] text-star-muted">
            How the countdown renders. These are computed states, not a live session.
          </p>
          <ul className="mt-2 divide-y divide-star-200 rounded-lg border border-[#e7ece7]">
            {samples.map((sample) => {
              const clock = sessionClock(sample.expiresAt, NOW);
              return (
                <li key={sample.label} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-[11px] text-star-muted">{sample.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-star-900">{clock.display}</span>
                    {clock.expired ? (
                      <StatusPill tone="danger">Expired</StatusPill>
                    ) : clock.warning ? (
                      <StatusPill tone="caution">Expiring soon</StatusPill>
                    ) : (
                      <StatusPill tone="positive">Active</StatusPill>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Card>

      <Card>
        <SectionHeading title="Active sessions" description="Devices currently signed in as you. Revocation is server-side." />
        <div className="mt-3 rounded-lg border border-[#e7ece7] p-4 text-center">
          <p className="text-xs font-bold text-star-900">No session information available</p>
          <p className="mx-auto mt-1 max-w-lg text-[11px] leading-4 text-star-muted">
            The session list comes from the backend. It stays empty until the staff auth contract is approved — no
            example devices are shown, because a staff member might try to revoke one.
          </p>
        </div>
        <div className="mt-3 flex justify-end">
          <PreparedAction contract="not-approved" variant="secondary">
            <LogOut size={13} aria-hidden="true" /> Revoke all other sessions
          </PreparedAction>
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

function ReauthPanel({ contract }: { contract: ContractState }) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const valid = isValidReauthShape(password) && (code === "" || isValidTotpShape(code));

  return (
    <Card>
      <SectionHeading
        title="Reauthentication"
        description="Required before approving money movement, changing bank details, granting a permission or viewing a KYC document."
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs font-bold">
            Password
            <input
              type="password"
              className={input + " mt-1"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
            <span className="mt-1 block text-[11px] font-normal text-star-muted">
              Checked by the backend. Never validated in the browser beyond a length sanity check.
            </span>
          </label>
          <label className="block text-xs font-bold">
            Second factor <span className="font-normal text-star-muted">(if required)</span>
            <input
              className={input + " mt-1 max-w-[12rem] tracking-[0.3em]"}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000"
              aria-label="Six digit second factor code"
            />
          </label>
          <div className="flex justify-end">
            <PreparedAction contract={contract} disabled={!valid}>
              <ShieldCheck size={14} aria-hidden="true" /> Confirm identity
            </PreparedAction>
          </div>
          <InertNote contract={contract} />
        </div>

        <div className="rounded-lg border border-[#e7ece7] bg-[#f8faf7] p-3">
          <p className="text-xs font-extrabold text-star-900">Actions that require reauthentication</p>
          <ul className="mt-2 space-y-1.5">
            {[
              "Approve an investment or transaction",
              "Approve a bank detail change",
              "Grant a staff permission",
              "View a KYC document",
              "Post a finance adjustment",
              "Change security settings",
            ].map((item) => (
              <li key={item} className="flex items-start gap-1.5 text-[11px] leading-4 text-[#263b2c]">
                <Lock size={11} aria-hidden="true" className="mt-0.5 shrink-0 text-star-muted" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-4 text-star-muted">
            The backend decides when a step-up is needed and re-checks it on submit. A satisfied step-up does not
            silently carry to a later action.
          </p>
        </div>
      </div>
    </Card>
  );
}
