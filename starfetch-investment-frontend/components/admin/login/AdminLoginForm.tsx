"use client";

/**
 * ADMIN LOGIN FORM — step one of two.
 *
 * The correction in this file is small and load-bearing: a successful password
 * POST no longer redirects to `/admin/dashboard`. It advances to the MFA
 * challenge, which is the only path that can produce a session.
 *
 * What the previous version did, and why it was wrong:
 *
 *     const res = await fetch('/api/admin-auth/login', …)
 *     if (res.ok) router.replace('/admin/dashboard')
 *
 * `res.ok` from `/login` meant "the password matched". Treating that as
 * "signed in" made a mandatory second factor decorative — a staff account with
 * MFA required would have reached the portal with a password alone.
 *
 * The BFF now refuses to shape a session from a password response, and this form
 * refuses to navigate on one. Both guards exist because either alone would be a
 * single point of failure.
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { button, input } from "@/components/admin/live/UI";
import {
  classifyMfaCode,
  readPasswordResponse,
  stepMessage,
  type LoginStep,
} from "@/lib/admin/mfa";
import { AdminMfaChallenge } from "./AdminMfaChallenge";



export function AdminLoginForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /**
   * Which step is on screen. Starts at `credentials` and can only reach
   * `authenticated` through the challenge component, which itself only advances
   * when the BFF reports a backend-confirmed session.
   */
  const [step, setStep] = useState<LoginStep>("credentials");
  const [challenge, setChallenge] = useState<{
    expiresAt: string | null;
    methods: ("passkey" | "security-key" | "totp" | "recovery-code")[];
    attempts: number;
  }>({ expiresAt: null, methods: ["totp", "recovery-code"], attempts: 0 });

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });

      const payload: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const code =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { code?: unknown } }).error?.code ?? "")
            : "";
        // A 401 after a valid password can still mean "second factor required" if
        // the backend signals it in the code, so the code is consulted first.
        const classified = classifyMfaCode(code, res.status);
        if (classified !== "credentials") {
          setChallenge({ expiresAt: null, methods: ["totp", "recovery-code"], attempts: 0 });
          setStep(classified);
          return;
        }
        setError(
          res.status === 429
            ? "Too many attempts. Try again later."
            : res.status === 503
              ? "Staff authentication is unavailable."
              : "Invalid staff credentials or insufficient authorization.",
        );
        return;
      }

      // A 2xx is NOT a sign-in. Read what factor the backend demands.
      const accepted = readPasswordResponse(payload, new Date().toISOString());
      setPassword("");
      if (!accepted) {
        // The backend accepted the password but did not say what to demand next.
        // That is an unusable contract, and guessing "let them in" is exactly the
        // failure this correction removes.
        setStep("unavailable");
        setError("The authentication service accepted the password but did not request a second factor.");
        return;
      }
      setChallenge({
        expiresAt: accepted.challengeExpiresAt,
        methods: accepted.methods.length > 0 ? accepted.methods : ["totp", "recovery-code"],
        attempts: 0,
      });
      setStep(accepted.step);
    } catch {
      setError("Staff authentication service is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  if (step !== "credentials") {
    return (
      <AdminMfaChallenge
        step={step}
        enabled={enabled}
        challengeExpiresAt={challenge.expiresAt}
        methods={challenge.methods}
        attempts={challenge.attempts}
        onVerified={() => {
          // Reached only when the BFF has set a session after backend-confirmed
          // verification. The dashboard re-verifies the session server-side.
          setStep("authenticated");
          router.replace("/admin/dashboard");
          router.refresh();
        }}
        onCancel={() => {
          setStep("credentials");
          setPassword("");
          setError("");
        }}
      />
    );
  }

  const copy = stepMessage("credentials");

  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-[#e6ece6] bg-white p-6 shadow-card sm:p-8">
      <h1 className="text-2xl font-extrabold text-star-900">{copy.title}</h1>
      <p className="mt-2 text-sm text-star-muted">{copy.body}</p>

      {!enabled && (
        <p role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Staff authentication is not yet enabled. Production access remains blocked until the backend and security
          review are complete.
        </p>
      )}

      <form className="mt-6 space-y-4" onSubmit={login}>
        <div>
          <label className="mb-1 block text-xs font-bold text-star-900" htmlFor="staff-email">
            Staff email
          </label>
          <input
            id="staff-email"
            className={input}
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!enabled || loading}
            placeholder="Your staff email"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-star-900" htmlFor="staff-password">
            Password
          </label>
          <div className="relative">
            <input
              id="staff-password"
              className={input + " pr-12"}
              required
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!enabled || loading}
              placeholder="Password"
            />
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-star-muted"
              disabled={!enabled}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-xs font-semibold text-red-700">
            {error}
          </p>
        )}
        <button className={button + " w-full"} disabled={!enabled || loading} type="submit">
          {loading ? "Checking staff credentials…" : "Continue"}
        </button>
      </form>

      <p className="mt-4 rounded-lg bg-[#f8faf7] px-3 py-2 text-[11px] leading-4 text-star-muted">
        Sign-in has two steps. This screen verifies your password only; a second factor is required next, and no staff
        session exists until it is confirmed by the backend.
      </p>

      <p className="mt-5 flex items-center justify-center gap-2 border-t border-star-200 pt-5 text-xs text-star-muted">
        <LockKeyhole size={15} /> Staff-only access. No public registration.
      </p>
    </div>
  );
}
