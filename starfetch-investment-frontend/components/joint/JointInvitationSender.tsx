"use client";

import { type FormEvent, useId, useState } from "react";
import { LoaderCircle, Mail, UserPlus } from "lucide-react";
import { createJointInvitation, type CreatedJointInvitation } from "@/lib/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatJointDate, getJointActionErrorMessage } from "./joint-api-messages";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function JointInvitationSender({ jointAccountId }: { jointAccountId: string }) {
  const { user } = useAuth();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreatedJointInvitation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) {
      setError("Enter a valid email address.");
      return;
    }
    if (user && normalizedEmail === user.email.trim().toLowerCase()) {
      setError("You cannot invite your own email address.");
      return;
    }
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      setResult(await createJointInvitation(jointAccountId, normalizedEmail));
      setEmail("");
    } catch (requestError) {
      setError(getJointActionErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="mt-5 rounded-xl border border-[#d9eac8] bg-[linear-gradient(115deg,#fbfdf5_0%,#eff8e8_100%)] p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><Mail size={20} aria-hidden="true" /></span><div><h2 className="text-base font-extrabold text-star-900">Invite a second account holder</h2><p className="mt-1 text-sm leading-6 text-star-muted">Send an invitation to the person you would like to add. They will need to sign in and accept it before joining this account.</p></div></div><form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Second account holder email address</span><input id={emailId} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" maxLength={254} placeholder="second.holder@example.com" aria-invalid={Boolean(error)} className="h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}{submitting ? "Sending…" : "Send invitation"}</button></form>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}{result ? <p role="status" className="mt-3 text-sm leading-6 text-star-900">Invitation created for {result.invitedEmailMasked}. It expires on {formatJointDate(result.expiresAt)}.</p> : null}</section>;
}
