"use client";

import { ArrowLeft, ArrowRight, Building2, CheckCircle2, LoaderCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { createCorporateApplication, getCorporateOnboarding, getCorporateOnboardingHistory, getSafeErrorMessage, isApiError } from "@/lib/api/client";
import { type CorporateApplicationHistory, type CorporateApplicationReceipt, type CorporateOnboardingRecord, maskCorporateValue } from "@/lib/corporate/application";
import { useAuth } from "./AuthProvider";
import { CorporateApplicantDetailsForm } from "./CorporateApplicantDetailsForm";
import { CorporateOnboardingStepper } from "./CorporateOnboardingStepper";
import { CorporatePersonalInformationForm } from "./CorporatePersonalInformationForm";
import { CorporateSecurityInformationForm } from "./CorporateSecurityInformationForm";
import { initialCorporateApplicationData, toCorporateDraftInput, type CorporateApplicationData, type CorporateFieldErrors } from "./corporate-onboarding-data";
import { CorporateVerificationProgress } from "@/components/corporate/CorporateVerificationProgress";

const emailPattern = /^\S+@\S+\.\S+$/;
const phonePattern = /^\+?[0-9\s()-]{7,20}$/;

type CorporateOnboardingStep = 1 | 2;

const stepCopy: Record<CorporateOnboardingStep, { title: string; description: string }> = {
  1: { title: "Business information", description: "Enter the six approved Corporate DRAFT fields. Only these fields are sent if the feature-gated Corporate registration service is enabled." },
  2: { title: "Review & create DRAFT", description: "Review the six fields before creating a Corporate DRAFT. Creation remains subject to the server’s privacy, KMS and feature-activation gates." },
};

function createIdempotencyKey() {
  if (typeof crypto === "undefined") throw new Error("Secure request-key generation is unavailable.");
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function creationErrorMessage(error: unknown) {
  if (!isApiError(error)) return "We could not create the Corporate DRAFT. No application was created.";
  if (error.code === "FEATURE_UNAVAILABLE") return "Corporate DRAFT creation is currently unavailable because the server activation gate is closed. No application was created.";
  if (error.code === "SERVICE_UNAVAILABLE") return "Corporate DRAFT creation is temporarily unavailable. No application was created; please try again later.";
  if (error.code === "CONFLICT") return "The server could not safely apply this Corporate DRAFT request. Review the details before retrying.";
  if (error.code === "RATE_LIMITED") return `Corporate DRAFT creation is rate limited.${error.retryAfterSeconds ? ` Please try again in ${error.retryAfterSeconds} seconds.` : " Please try again later."}`;
  return `${getSafeErrorMessage(error)} No application was created.`;
}

function readErrorMessage(error: unknown) {
  if (!isApiError(error)) return "The Corporate DRAFT was created, but its approved status or history could not be loaded. Try the read again.";
  if (error.code === "NOT_FOUND") return "The Corporate DRAFT was created, but this account cannot currently read that record. No additional account discovery is attempted.";
  if (error.code === "SERVICE_UNAVAILABLE") return "The Corporate DRAFT was created, but the approved details read is temporarily unavailable. Try the read again later.";
  return `The Corporate DRAFT was created, but its approved status or history could not be loaded. ${getSafeErrorMessage(error)}`;
}

function CorporateDraftUnavailable() {
  return <main className="min-h-[calc(100vh-76px)] bg-[#fffef9] px-5 py-10 sm:px-8 sm:py-14"><section className="mx-auto max-w-xl rounded-2xl border border-star-200 bg-white p-6 text-center shadow-card sm:p-8"><span className="mx-auto grid size-12 place-items-center rounded-full bg-star-100 text-star-700"><ShieldAlert size={24} aria-hidden="true" /></span><h1 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.04em] text-star-900">Sign in to prepare a Corporate DRAFT</h1><p className="mt-3 text-sm leading-6 text-star-muted">Corporate DRAFT preparation requires a verified, authenticated Corporate applicant session. Create a Corporate login and verify its email first, or sign in to continue an existing Corporate application.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/register/corporate" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-star-200 bg-white px-5 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Create Corporate login</Link><Link href="/login?next=%2Fregister%2Fcorporate" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Sign in to continue</Link></div></section></main>;
}

export function CorporateOnboardingFlow() {
  const { status, user } = useAuth();
  const [step, setStep] = useState<CorporateOnboardingStep>(1);
  const [data, setData] = useState<CorporateApplicationData>(initialCorporateApplicationData);
  const [errors, setErrors] = useState<CorporateFieldErrors>({});
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CorporateApplicationReceipt | null>(null);
  const [onboarding, setOnboarding] = useState<CorporateOnboardingRecord | null>(null);
  const [history, setHistory] = useState<CorporateApplicationHistory | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const requestEpoch = useRef(0);
  const currentCopy = stepCopy[step];

  // Draft fields, idempotency material and owner-scoped read results are
  // ephemeral. They must never cross account, logout, or session boundaries.
  useEffect(() => {
    activeUserId.current = status === "authenticated" && user ? user.id : null;
    requestEpoch.current += 1;
    setStep(1);
    setData(initialCorporateApplicationData);
    setErrors({});
    setIdempotencyKey(null);
    setCreating(false);
    setCreationError(null);
    setReceipt(null);
    setOnboarding(null);
    setHistory(null);
    setReading(false);
    setReadError(null);
  }, [status, user?.id]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as keyof CorporateApplicationData;
    const value: string | boolean = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setData((current) => ({ ...current, [name]: value } as CorporateApplicationData));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setCreationError(null);
    // A changed field is a new logical request, so a future retry receives a
    // new opaque key rather than reusing a key for different O2 content.
    setIdempotencyKey(null);
  }

  function validateBusinessInformation() {
    const nextErrors: CorporateFieldErrors = {};
    if (!data.institutionName.trim()) nextErrors.institutionName = "Enter the institution name.";
    if (!data.dateOfIncorporation) nextErrors.dateOfIncorporation = "Select the incorporation date.";
    else if (data.dateOfIncorporation > new Date().toISOString().slice(0, 10)) nextErrors.dateOfIncorporation = "Date of incorporation cannot be in the future.";
    if (!data.rcNumber.trim()) nextErrors.rcNumber = "Enter the RC number.";
    if (!data.taxIdentificationNumber.trim()) nextErrors.taxIdentificationNumber = "Enter the TIN.";
    if (!data.businessPhoneNumber.trim()) nextErrors.businessPhoneNumber = "Enter the business phone number.";
    else if (!phonePattern.test(data.businessPhoneNumber.trim())) nextErrors.businessPhoneNumber = "Enter a valid business phone number.";
    if (!data.businessEmail.trim()) nextErrors.businessEmail = "Enter the business email.";
    else if (!emailPattern.test(data.businessEmail.trim())) nextErrors.businessEmail = "Enter a valid business email.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateReview() {
    const nextErrors: CorporateFieldErrors = {};
    if (!data.authorizationConfirmed) nextErrors.authorizationConfirmed = "Confirm your authority to continue.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function loadOwnerScopedReads(corporateAccountId: string, ownerId: string) {
    const epoch = requestEpoch.current + 1;
    requestEpoch.current = epoch;
    setReading(true);
    setReadError(null);
    const [onboardingResult, historyResult] = await Promise.allSettled([
      getCorporateOnboarding(corporateAccountId),
      getCorporateOnboardingHistory(corporateAccountId),
    ]);
    if (requestEpoch.current !== epoch || activeUserId.current !== ownerId) return;
    setReading(false);
    if (onboardingResult.status === "fulfilled") setOnboarding(onboardingResult.value);
    if (historyResult.status === "fulfilled") setHistory(historyResult.value);
    const failed = onboardingResult.status === "rejected" ? onboardingResult.reason : historyResult.status === "rejected" ? historyResult.reason : null;
    if (failed) setReadError(readErrorMessage(failed));
  }

  async function submitDraft() {
    if (!user || creating || receipt || !validateReview()) return;
    const ownerId = user.id;
    const epoch = requestEpoch.current + 1;
    requestEpoch.current = epoch;
    let requestKey = idempotencyKey;
    try {
      requestKey ??= createIdempotencyKey();
      setIdempotencyKey(requestKey);
    } catch {
      setCreationError("Secure request-key generation is unavailable. No application was created.");
      return;
    }

    setCreating(true);
    setCreationError(null);
    try {
      const created = await createCorporateApplication(toCorporateDraftInput(data), requestKey);
      if (requestEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      setReceipt(created);
      // Clear sensitive values immediately after the confirmed 201 receipt.
      setData(initialCorporateApplicationData);
      setErrors({});
      setIdempotencyKey(null);
      setCreating(false);
      void loadOwnerScopedReads(created.corporateAccountId, ownerId);
    } catch (error) {
      if (requestEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      setCreating(false);
      setCreationError(creationErrorMessage(error));
      // Preserve data and the same opaque key only for a retry of this exact
      // logical request. Neither is persisted to browser storage.
    }
  }

  if (status === "loading") return <main className="grid min-h-[calc(100vh-76px)] place-items-center bg-[#fffef9] px-5 text-center"><div><LoaderCircle size={30} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Restoring your secure session…</p></div></main>;
  if (status !== "authenticated" || !user) return <CorporateDraftUnavailable />;

  // Corporate applicants intentionally have no Individual InvestorProfile; an
  // empty SafeUser name is meaningful and must not be replaced with a name.
  const proceed = () => { if (step === 1 && validateBusinessInformation()) setStep(2); };
  const goBack = () => { setErrors({}); setCreationError(null); setStep(1); };
  const retryOwnerScopedReads = receipt ? () => { void loadOwnerScopedReads(receipt.corporateAccountId, user.id); } : undefined;

  return <main className="min-h-[calc(100vh-76px)] bg-[#fffef9] px-5 py-10 sm:px-8 sm:py-14 lg:px-10 lg:py-16"><section className="mx-auto w-full max-w-3xl"><div className="text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-star-100 text-star-700" aria-hidden="true"><Building2 size={24} /></span><p className="mt-5 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-star-700">Corporate application</p><h1 className="mt-3 font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.045em] text-star-900">Prepare a Corporate DRAFT</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted sm:text-[0.96rem]">The approved O2 service creates a DRAFT only when its backend activation gates are enabled. It does not submit, approve, fund or grant investment access.</p></div><CorporateOnboardingStepper currentStep={step} /><section className="mt-8 rounded-2xl border border-star-200 bg-white p-6 shadow-card sm:mt-10 sm:p-8" aria-labelledby="corporate-step-heading"><p className="text-xs font-bold text-star-700">Step {step} of 2</p><h2 id="corporate-step-heading" className="mt-2 text-[clamp(1.45rem,2.5vw,2rem)] font-extrabold tracking-[-0.035em] text-star-900">{receipt ? "Corporate DRAFT created" : currentCopy.title}</h2><p className="mt-2 text-sm leading-6 text-star-muted">{receipt ? "The server returned an O2 creation receipt. Owner-scoped O3 details and permitted O11 history are loaded only with the returned Corporate account ID, which remains in memory for this session." : currentCopy.description}</p>{receipt ? <div className="mt-6 rounded-xl border border-[#bfe8ca] bg-[#effbf2] p-4 text-sm leading-6 text-star-800" role="status"><span className="flex items-center gap-2 font-extrabold text-star-900"><CheckCircle2 size={18} aria-hidden="true" />Corporate DRAFT created</span><p className="mt-1">Details version {receipt.detailsVersion} was created. This is not a submission, verification result, approval or investment authorisation.</p></div> : <><div className="mt-7">{step === 1 ? <CorporateApplicantDetailsForm data={data} errors={errors} onChange={handleChange} /> : null}{step === 2 ? <div className="space-y-5"><CorporatePersonalInformationForm fullName={`${user.firstName} ${user.lastName}`.trim()} email={user.email} /><CorporateSecurityInformationForm data={data} errors={errors} onChange={handleChange} /><section className="rounded-xl border border-star-200 bg-white" aria-labelledby="corporate-draft-review-heading"><div className="border-b border-star-100 px-5 py-4"><h3 id="corporate-draft-review-heading" className="text-base font-extrabold text-star-900">Draft business details</h3><p className="mt-1 text-xs leading-5 text-star-muted">Sensitive values are masked in this review. TIN is sent only over the authenticated O2 request and is never retained by this page after a confirmed creation.</p></div><dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">{[["Institution name", data.institutionName], ["Date of incorporation", data.dateOfIncorporation], ["RC number", data.rcNumber], ["Tax Identification Number", maskCorporateValue(data.taxIdentificationNumber)], ["Business phone number", maskCorporateValue(data.businessPhoneNumber)], ["Business email", maskCorporateValue(data.businessEmail)]].map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-star-700">{value || "—"}</dd></div>)}</dl></section></div> : null}</div><div className="mt-8 flex flex-col-reverse gap-3 border-t border-star-100 pt-6 sm:flex-row sm:items-center sm:justify-between">{step === 1 ? <Link href="/open-account" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-5 text-sm font-bold text-star-700 no-underline transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Cancel</Link> : <button type="button" onClick={goBack} disabled={creating} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-5 text-sm font-bold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><ArrowLeft size={16} aria-hidden="true" />Back</button>}{step === 1 ? <button type="button" onClick={proceed} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Continue to review<ArrowRight size={16} aria-hidden="true" /></button> : <button type="button" onClick={() => { void submitDraft(); }} disabled={creating} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:-translate-y-px hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{creating ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Creating Corporate DRAFT…</> : "Create Corporate DRAFT"}</button>}</div>{creationError ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{creationError}</p> : null}{step === 2 ? <p className="mt-4 rounded-lg border border-[#f2d89d] bg-[#fff9e8] px-4 py-3 text-xs leading-5 text-star-muted">If creation is unavailable, no local success is shown. Retries reuse the same opaque Idempotency-Key only while these unchanged form values remain in this page memory.</p> : null}</>}</section>{receipt ? <div className="mt-6"><CorporateVerificationProgress onboarding={onboarding} history={history} loading={reading} readError={readError} onRetryRead={retryOwnerScopedReads} /><div className="mt-4 flex flex-col gap-3 rounded-lg border border-star-200 bg-star-50 px-4 py-3 text-xs leading-5 text-star-muted sm:flex-row sm:items-center sm:justify-between"><p>This portal does not persist the Corporate account ID in browser storage or a URL. Returning applicants use the authenticated owner-scoped Corporate application discovery API from the Corporate dashboard.</p><Link href="/corporate/dashboard" className="shrink-0 text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3">View Corporate application</Link></div></div> : null}</section></main>;
}
