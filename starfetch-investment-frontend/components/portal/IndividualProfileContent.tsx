"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Info, LoaderCircle, Save, ShieldCheck, UserRound } from "lucide-react";
import { getMyProfile, getSafeErrorMessage, isApiError, type IndividualAccountProfile, updateMyProfile } from "@/lib/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { BankDetailsDraft, emptyBankDetailsDraft } from "./BankDetailsDraft";
import { InvestmentObjectiveRiskProfileDraft, emptyInvestmentObjectiveRiskDraft } from "./InvestmentObjectiveRiskProfileDraft";
import { PepDeclarationDraft, emptyPepDeclarationDraft } from "./PepDeclarationDraft";
import { SourceOfFundsDraft, emptySourceOfFundsDraft } from "./SourceOfFundsDraft";

type ProfileRequestState = "loading" | "success" | "error";

type LocalKycDraft = {
  dateOfBirth: string;
  gender: string;
  nationality: string;
  residentialAddress: string;
  stateOfResidence: string;
  idCardType: string;
  occupation: string;
};

type UnsupportedProfileSection = {
  title: string;
  description: string;
};

const idCardTypes = ["", "Passport", "PVC", "Driver’s License", "NIN"];
const unsupportedSections: UnsupportedProfileSection[] = [
  { title: "Documents", description: "Document upload and storage are not available in the current portal." },
];

function emptyLocalKycDraft(): LocalKycDraft {
  return {
    dateOfBirth: "",
    gender: "",
    nationality: "",
    residentialAddress: "",
    stateOfResidence: "",
    idCardType: "",
    occupation: "",
  };
}

function inputClassName(readOnly = false) {
  return `min-h-11 w-full rounded-md border border-star-200 px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100 ${readOnly ? "cursor-not-allowed bg-star-50 text-star-muted" : "bg-white"}`;
}

function UnsupportedSection({ title, description }: UnsupportedProfileSection) {
  return (
    <article className="rounded-xl border border-star-200 bg-star-50 p-4">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-star-700">
          <ShieldCheck size={19} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-extrabold text-star-900">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-star-muted">{description}</p>
          <p className="mt-3 text-xs font-bold text-star-700">Unavailable pending approved backend support</p>
        </div>
      </div>
    </article>
  );
}

export function IndividualProfileContent() {
  const { status: authStatus, invalidateSession } = useAuth();
  const [requestState, setRequestState] = useState<ProfileRequestState>("loading");
  const [profile, setProfile] = useState<IndividualAccountProfile | null>(null);
  const [localKycDraft, setLocalKycDraft] = useState<LocalKycDraft>(emptyLocalKycDraft);
  const [localInvestmentRiskDraft, setLocalInvestmentRiskDraft] = useState(emptyInvestmentObjectiveRiskDraft);
  const [localBankDetailsDraft, setLocalBankDetailsDraft] = useState(emptyBankDetailsDraft);
  const [localPepDeclarationDraft, setLocalPepDeclarationDraft] = useState(emptyPepDeclarationDraft);
  const [localSourceOfFundsDraft, setLocalSourceOfFundsDraft] = useState(emptySourceOfFundsDraft);
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
    if (authStatus === "authenticated") {
      void loadProfile();
    } else {
      setLocalKycDraft(emptyLocalKycDraft());
      setLocalInvestmentRiskDraft(emptyInvestmentObjectiveRiskDraft());
      setLocalBankDetailsDraft(emptyBankDetailsDraft());
      setLocalPepDeclarationDraft(emptyPepDeclarationDraft());
      setLocalSourceOfFundsDraft(emptySourceOfFundsDraft());
    }

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
      // The current approved profile API requires the account-managed name
      // fields alongside the editable phone number. Names remain unchanged in
      // this UI; all local KYC/PEP draft fields are deliberately omitted.
      const savedProfile = await updateMyProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        phone: profile.phone?.trim() || null,
      });
      setProfile(savedProfile);
      setNotice("Your supported profile details have been saved. Local KYC draft details were not submitted or stored.");
    } catch (error) {
      if (isApiError(error) && error.code === "UNAUTHENTICATED") invalidateSession();
      setNotice(getSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl" aria-labelledby="individual-profile-heading">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm font-extrabold text-star-700 no-underline transition hover:text-star-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Return to Dashboard
      </Link>

      <div className="mt-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Individual account</p>
        <h1 id="individual-profile-heading" className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">
          Profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted">
          Review the personal contact information currently supported by your Starfetch account.
        </p>
      </div>

      {requestState === "loading" ? (
        <section className="mt-7 rounded-xl border border-star-200 bg-white p-6" aria-busy="true">
          <div className="flex items-center gap-3 text-sm font-semibold text-star-muted">
            <LoaderCircle size={20} className="animate-spin text-star-700" aria-hidden="true" />
            Loading your profile…
          </div>
        </section>
      ) : null}

      {requestState === "error" ? (
        <section className="mt-7 rounded-xl border border-star-200 bg-star-50 p-6" role="alert">
          <h2 className="text-lg font-extrabold text-star-900">We couldn&apos;t load your profile.</h2>
          <p className="mt-2 text-sm text-star-muted">Please try again.</p>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="mt-5 min-h-10 rounded-md bg-star-900 px-4 text-sm font-bold text-white transition hover:bg-star-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        </section>
      ) : null}

      {requestState === "success" && profile ? (
        <>
          <form onSubmit={saveProfile} className="mt-7 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700">
                <UserRound size={22} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-star-900">Personal Information</h2>
                <p className="mt-1 text-sm leading-6 text-star-muted">Your account-managed name and email are read-only. Only your phone number can be changed here.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-extrabold text-star-900">First name</span>
                <input type="text" value={profile.firstName} readOnly aria-readonly="true" className={`mt-2 ${inputClassName(true)}`} />
              </label>
              <label className="block">
                <span className="text-sm font-extrabold text-star-900">Last name</span>
                <input type="text" value={profile.lastName} readOnly aria-readonly="true" className={`mt-2 ${inputClassName(true)}`} />
              </label>
              <p className="sm:col-span-2 text-xs leading-5 text-star-muted">Your name is managed by your account and cannot be changed here.</p>
              <label className="block sm:col-span-2">
                <span className="text-sm font-extrabold text-star-900">Email address</span>
                <input type="email" value={profile.email} readOnly aria-readonly="true" className={`mt-2 ${inputClassName(true)}`} />
                <span className="mt-1 block text-xs text-star-muted">Your email address is managed by your account and cannot be changed here.</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-extrabold text-star-900">Phone number</span>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={profile.phone ?? ""}
                  onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                  placeholder="Add a phone number"
                  className={`mt-2 ${inputClassName()}`}
                />
              </label>
            </div>

            <div className="mt-7 border-t border-star-100 pt-6">
              <h3 className="text-base font-extrabold text-star-900">KYC details</h3>
              <p className="mt-1 text-sm leading-6 text-star-muted">
                These fields are available for your current-page draft only. They are not submitted, saved, verified or retained when you leave or refresh this page because no approved backend KYC profile contract is available.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-extrabold text-star-900">Date of birth</span>
                  <input
                    type="date"
                    autoComplete="bday"
                    value={localKycDraft.dateOfBirth}
                    onChange={(event) => setLocalKycDraft((current) => ({ ...current, dateOfBirth: event.target.value }))}
                    className={`mt-2 ${inputClassName()}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-extrabold text-star-900">Gender</span>
                  <input
                    type="text"
                    autoComplete="sex"
                    value={localKycDraft.gender}
                    onChange={(event) => setLocalKycDraft((current) => ({ ...current, gender: event.target.value }))}
                    placeholder="Enter gender"
                    className={`mt-2 ${inputClassName()}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-extrabold text-star-900">Nationality</span>
                  <input
                    type="text"
                    autoComplete="country-name"
                    value={localKycDraft.nationality}
                    onChange={(event) => setLocalKycDraft((current) => ({ ...current, nationality: event.target.value }))}
                    placeholder="Enter nationality"
                    className={`mt-2 ${inputClassName()}`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-extrabold text-star-900">State of residence</span>
                  <input
                    type="text"
                    autoComplete="address-level1"
                    value={localKycDraft.stateOfResidence}
                    onChange={(event) => setLocalKycDraft((current) => ({ ...current, stateOfResidence: event.target.value }))}
                    placeholder="Enter state of residence"
                    className={`mt-2 ${inputClassName()}`}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-extrabold text-star-900">Residential address</span>
                  <textarea
                    rows={3}
                    autoComplete="street-address"
                    value={localKycDraft.residentialAddress}
                    onChange={(event) => setLocalKycDraft((current) => ({ ...current, residentialAddress: event.target.value }))}
                    placeholder="Enter residential address"
                    className={`mt-2 ${inputClassName()} py-3`}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-extrabold text-star-900">ID card type</span>
                  <select
                    value={localKycDraft.idCardType}
                    onChange={(event) => setLocalKycDraft((current) => ({ ...current, idCardType: event.target.value }))}
                    className={`mt-2 ${inputClassName()}`}
                  >
                    <option value="">Select ID card type</option>
                    {idCardTypes.slice(1).map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-extrabold text-star-900">Occupation</span>
                  <input
                    type="text"
                    autoComplete="organization-title"
                    value={localKycDraft.occupation}
                    onChange={(event) => setLocalKycDraft((current) => ({ ...current, occupation: event.target.value }))}
                    placeholder="Enter occupation"
                    className={`mt-2 ${inputClassName()}`}
                  />
                </label>
              </div>
            </div>

            <PepDeclarationDraft value={localPepDeclarationDraft} onChange={setLocalPepDeclarationDraft} />

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              {notice ? <p role="status" className="text-sm font-semibold text-star-700">{notice}</p> : <span />}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={17} aria-hidden="true" />
                {saving ? "Saving…" : "Save phone number"}
              </button>
            </div>
          </form>

          <InvestmentObjectiveRiskProfileDraft value={localInvestmentRiskDraft} onChange={setLocalInvestmentRiskDraft} />
          <SourceOfFundsDraft value={localSourceOfFundsDraft} onChange={setLocalSourceOfFundsDraft} />
          <BankDetailsDraft value={localBankDetailsDraft} onChange={setLocalBankDetailsDraft} />

          <section className="mt-7" aria-labelledby="onboarding-unavailable-heading">
            <div className="flex gap-3 rounded-xl border border-[#d9eac8] bg-[linear-gradient(115deg,#f6faee_0%,#edf6e3_100%)] p-4">
              <Info size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" />
              <div>
                <h2 id="onboarding-unavailable-heading" className="text-base font-extrabold text-star-900">Additional onboarding is not available yet</h2>
                <p className="mt-1 text-sm leading-6 text-star-muted">These areas have no approved backend storage or verification workflow. The portal does not collect or claim to save this information.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {unsupportedSections.map((section) => <UnsupportedSection key={section.title} {...section} />)}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
