"use client";

import { type FormEvent, useId, useState } from "react";
import { CheckCircle2, LoaderCircle, Mail, UserRound, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createJointAccount, type CreatedJointAccount } from "@/lib/api/client";
import { useAuth } from "./AuthProvider";
import { getJointActionErrorMessage, formatJointDate } from "@/components/joint/joint-api-messages";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { displayName?: string; inviteeEmail?: string };

/** Phase 4A M1 form: the signed-in Investor is holder one; only invitee email is collected. */
export function JointApplicantDetailsForm() {
  const router = useRouter();
  const { user, status } = useAuth();
  const displayNameId = useId();
  const inviteeEmailId = useId();
  const [displayName, setDisplayName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedJointAccount | null>(null);

  if (status !== "authenticated" || !user) return null;

  const userFullName = `${user.firstName} ${user.lastName}`.trim();
  const authenticatedEmail = user.email.trim().toLowerCase();
  // The authenticated /me projection confirms verified status before M1 is enabled.
  const knownUnverified = user.emailVerified !== true;

  function validate() {
    const nextErrors: FieldErrors = {};
    const trimmedDisplayName = displayName.trim();
    const normalizedInviteeEmail = inviteeEmail.trim().toLowerCase();
    if (trimmedDisplayName.length > 60) nextErrors.displayName = "Use 60 characters or fewer for the account name.";
    if (!normalizedInviteeEmail) nextErrors.inviteeEmail = "Enter the second holder's email address.";
    else if (normalizedInviteeEmail.length > 254 || !emailPattern.test(normalizedInviteeEmail)) nextErrors.inviteeEmail = "Enter a valid email address.";
    else if (normalizedInviteeEmail === authenticatedEmail) nextErrors.inviteeEmail = "You cannot invite your own email address.";
    return { nextErrors, trimmedDisplayName, normalizedInviteeEmail };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || knownUnverified) return;
    const { nextErrors, trimmedDisplayName, normalizedInviteeEmail } = validate();
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const response = await createJointAccount({ inviteeEmail: normalizedInviteeEmail, ...(trimmedDisplayName ? { displayName: trimmedDisplayName } : {}) });
      setCreated(response);
    } catch (error) {
      setServerError(getJointActionErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (created) return <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#cce7d0] bg-white p-6 shadow-card sm:p-8"><span className="grid size-12 place-items-center rounded-full bg-[#e1f7e7] text-[#16743d]"><CheckCircle2 size={26} aria-hidden="true" /></span><p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account initiated</p><h1 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.04em] text-star-900">Awaiting second holder</h1><p className="mt-3 text-sm leading-6 text-star-muted">{created.displayName} has been created with you as the first active holder. The second holder must independently sign in and accept their invitation before they can access the account.</p><dl className="mt-6 divide-y divide-star-100 rounded-xl border border-star-200 bg-star-50 px-4"><div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-700">Account</dt><dd className="text-sm font-extrabold text-star-900">{created.displayName}</dd></div><div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-700">Invitation status</dt><dd className="text-sm font-extrabold text-star-900">{created.invitation.status}</dd></div><div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-700">Invitee</dt><dd className="text-sm font-extrabold text-star-900">{created.invitation.invitedEmailMasked}</dd></div><div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-700">Expires</dt><dd className="text-sm font-extrabold text-star-900">{formatJointDate(created.invitation.expiresAt)}</dd></div></dl><p className="mt-4 text-xs leading-5 text-star-muted">This page confirms the backend-created pending invitation. It does not confirm email delivery or create an account for the invitee.</p><button type="button" onClick={() => router.push("/joint/dashboard")} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Open Joint Accounts</button></section>;

  return <section className="mx-auto w-full max-w-4xl"><header className="mx-auto max-w-2xl text-center"><p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Joint account</p><h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Open a Joint Account</h1><p className="mx-auto mt-3 text-sm leading-6 text-star-muted sm:text-[0.96rem]">You are the first holder. Invite the second holder by email; they must independently accept before they gain access.</p></header>{knownUnverified ? <div role="alert" className="mx-auto mt-8 max-w-2xl rounded-xl border border-[#f4d5a5] bg-[#fff8e9] p-5 text-center"><h2 className="font-extrabold text-star-900">Email verification required</h2><p className="mt-2 text-sm leading-6 text-star-muted">Verify your email address before opening a Joint Account or responding to invitations. No account request has been sent.</p></div> : <form noValidate onSubmit={submit} className="mx-auto mt-9 max-w-4xl"><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:p-7" aria-labelledby="initiator-heading"><div className="flex items-center gap-3 border-b border-star-100 pb-5"><span className="grid size-10 place-items-center rounded-full bg-star-100 text-sm font-extrabold text-star-700" aria-hidden="true">1</span><h2 id="initiator-heading" className="text-xl font-extrabold text-star-900">First holder</h2></div><div className="mt-6 space-y-4"><p className="text-sm leading-6 text-star-muted">Your details come from your authenticated Starfetch investor account.</p><div className="rounded-xl bg-star-50 p-4"><p className="flex items-center gap-2 text-sm font-extrabold text-star-900"><UserRound size={17} className="text-star-700" aria-hidden="true" />{userFullName || "Your Starfetch account"}</p><p className="mt-2 flex items-center gap-2 text-sm text-star-muted"><Mail size={16} className="text-star-700" aria-hidden="true" />{user.email}</p></div><label htmlFor={displayNameId} className="block"><span className="mb-2 block text-sm font-bold text-star-900">Joint account display name <span className="font-medium text-star-muted">— optional</span></span><input id={displayNameId} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setErrors((current) => ({ ...current, displayName: undefined })); }} maxLength={61} autoComplete="off" placeholder="e.g. The Okeke Family" aria-invalid={Boolean(errors.displayName)} aria-describedby={errors.displayName ? `${displayNameId}-error` : undefined} className={inputClassName(Boolean(errors.displayName))} />{errors.displayName ? <p id={`${displayNameId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.displayName}</p> : <p className="mt-2 text-xs leading-5 text-star-muted">If omitted, the backend supplies an interim name from your authenticated profile.</p>}</label></div></section><section className="rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:p-7" aria-labelledby="invitee-heading"><div className="flex items-center gap-3 border-b border-star-100 pb-5"><span className="grid size-10 place-items-center rounded-full bg-star-100 text-sm font-extrabold text-star-700" aria-hidden="true">2</span><h2 id="invitee-heading" className="text-xl font-extrabold text-star-900">Second holder</h2></div><div className="mt-6"><p className="text-sm leading-6 text-star-muted">Enter only the email address for the person you want to invite. Do not enter their date of birth, phone number, identity information, or banking details.</p><label htmlFor={inviteeEmailId} className="mt-5 block"><span className="mb-2 block text-sm font-bold text-star-900">Email address <span className="text-star-700" aria-hidden="true">*</span></span><input id={inviteeEmailId} type="email" value={inviteeEmail} onChange={(event) => { setInviteeEmail(event.target.value); setErrors((current) => ({ ...current, inviteeEmail: undefined })); }} maxLength={254} autoComplete="email" placeholder="second.holder@example.com" aria-invalid={Boolean(errors.inviteeEmail)} aria-describedby={errors.inviteeEmail ? `${inviteeEmailId}-error` : undefined} className={inputClassName(Boolean(errors.inviteeEmail))} />{errors.inviteeEmail ? <p id={`${inviteeEmailId}-error`} className="mt-2 text-xs font-medium text-red-700">{errors.inviteeEmail}</p> : null}</label></div></section></div><div className="mx-auto mt-7 max-w-2xl rounded-xl border border-star-200 bg-star-50 p-4 text-sm leading-6 text-star-muted"><p className="flex gap-2"><UsersRound size={18} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><span>Submitting creates one active holder and one pending invitation only. It does not create, verify, or approve the other person&apos;s account.</span></p></div><button type="submit" disabled={submitting} className="mx-auto mt-7 inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition duration-200 hover:-translate-y-px hover:bg-[#c7f238] hover:shadow-[0_6px_16px_rgba(0,59,42,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Creating account…</> : "Create Joint Account and Invitation"}</button>{serverError ? <p role="alert" className="mx-auto mt-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-center text-xs leading-5 text-red-700">{serverError}</p> : null}</form>}</section>;
}

function inputClassName(hasError: boolean) {
  return `h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/75 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${hasError ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`;
}
