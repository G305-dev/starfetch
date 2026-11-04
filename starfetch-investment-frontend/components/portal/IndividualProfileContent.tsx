"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Info, LoaderCircle, Save, ShieldCheck, UserRound } from "lucide-react";
import { getMyProfile, getSafeErrorMessage, isApiError, type IndividualAccountProfile, updateMyProfile } from "@/lib/api/client";
import { useAuth } from "@/components/auth/AuthProvider";

type ProfileRequestState = "loading" | "success" | "error";

type UnsupportedProfileSection = {
  title: string;
  description: string;
};

const unsupportedSections: UnsupportedProfileSection[] = [
  { title: "Identity Verification", description: "Identity checks are not available in this portal yet. Do not enter BVN, NIN, document, or other identity details here." },
  { title: "Employment and Source of Funds", description: "This onboarding section is pending backend support and cannot be saved from the portal yet." },
  { title: "Bank Details", description: "Bank-account collection is not available in this portal yet. Do not enter bank details until Starfetch provides a secured onboarding flow." },
  { title: "PEP Declaration", description: "Regulatory declarations are not available in the current backend profile contract." },
  { title: "Investment Risk Profile", description: "Risk-profile onboarding is pending an approved backend workflow." },
  { title: "Documents", description: "Document upload and storage are not available in the current portal." },
];

function inputClassName(disabled = false) {
  return `min-h-11 w-full rounded-md border border-star-200 px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${disabled ? "cursor-not-allowed bg-star-50 text-star-muted" : "bg-white"}`;
}

function UnsupportedSection({ title, description }: UnsupportedProfileSection) {
  return <article className="rounded-xl border border-star-200 bg-star-50 p-4"><div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-star-700"><ShieldCheck size={19} aria-hidden="true" /></span><div><h2 className="text-sm font-extrabold text-star-900">{title}</h2><p className="mt-1 text-sm leading-6 text-star-muted">{description}</p><p className="mt-3 text-xs font-bold text-star-700">Unavailable pending approved backend support</p></div></div></article>;
}

export function IndividualProfileContent() {
  const { status: authStatus, invalidateSession } = useAuth();
  const [requestState, setRequestState] = useState<ProfileRequestState>("loading");
  const [profile, setProfile] = useState<IndividualAccountProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const requestVersion = useRef(0);

  const loadProfile = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setRequestState("loading");
    setNotice("");
    try {
      const nextProfile = await getMyProfile();
      if (version !== requestVersion.current) return;
      setProfile(nextProfile);
      setRequestState("success");
    } catch (error) {
      if (version !== requestVersion.current) return;
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setProfile(null);
      setRequestState("error");
    }
  }, [invalidateSession]);

  useEffect(() => {
    if (authStatus === "authenticated") void loadProfile();
    return () => {
      requestVersion.current += 1;
    };
  }, [authStatus, loadProfile]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setNotice("");
    try {
      const savedProfile = await updateMyProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim() || null,
      });
      setProfile(savedProfile);
      setNotice("Your personal profile details have been saved.");
    } catch (error) {
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setNotice(getSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return <section className="mx-auto max-w-6xl" aria-labelledby="individual-profile-heading"><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-extrabold text-star-700 no-underline transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><ArrowLeft size={17} aria-hidden="true" />Return to Dashboard</Link><div className="mt-5"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Individual account</p><h1 id="individual-profile-heading" className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Profile</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted">Review the personal contact information currently supported by your Starfetch account.</p></div>{requestState === "loading" ? <section className="mt-7 rounded-xl border border-star-200 bg-white p-6" aria-busy="true"><div className="flex items-center gap-3 text-sm font-semibold text-star-muted"><LoaderCircle size={20} className="animate-spin text-star-700" aria-hidden="true" />Loading your profile…</div></section> : null}{requestState === "error" ? <section className="mt-7 rounded-xl border border-star-200 bg-star-50 p-6" role="alert"><h2 className="text-lg font-extrabold text-star-900">We couldn&apos;t load your profile.</h2><p className="mt-2 text-sm text-star-muted">Please try again.</p><button type="button" onClick={() => void loadProfile()} className="mt-5 min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Retry</button></section> : null}{requestState === "success" && profile ? <><form onSubmit={saveProfile} className="mt-7 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><UserRound size={22} aria-hidden="true" /></span><div><h2 className="text-xl font-extrabold text-star-900">Personal Information</h2><p className="mt-1 text-sm leading-6 text-star-muted">Only the fields below are currently supported by the Starfetch profile API.</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-extrabold text-star-900">First name</span><input required value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900">Last name</span><input required value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} className={`mt-2 ${inputClassName()}`} /></label><label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">Email address</span><input type="email" value={profile.email} readOnly aria-readonly="true" className={`mt-2 ${inputClassName(true)}`} /><span className="mt-1 block text-xs text-star-muted">Your email address is managed by your account and cannot be changed here.</span></label><label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">Phone number</span><input type="tel" autoComplete="tel" value={profile.phone ?? ""} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="Add a phone number" className={`mt-2 ${inputClassName()}`} /></label></div><div className="mt-6 flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">{notice ? <p role="status" className="text-sm font-semibold text-star-700">{notice}</p> : <span /> }<button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><Save size={17} aria-hidden="true" />{saving ? "Saving…" : "Save changes"}</button></div></form><section className="mt-7" aria-labelledby="onboarding-unavailable-heading"><div className="flex gap-3 rounded-xl border border-[#d9eac8] bg-[linear-gradient(115deg,#f6faee_0%,#edf6e3_100%)] p-4"><Info size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><div><h2 id="onboarding-unavailable-heading" className="text-base font-extrabold text-star-900">Additional onboarding is not available yet</h2><p className="mt-1 text-sm leading-6 text-star-muted">These areas have no approved backend storage or verification workflow. The portal does not collect or claim to save this information.</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-2">{unsupportedSections.map((section) => <UnsupportedSection key={section.title} {...section} />)}</div></section></> : null}</section>;
}
