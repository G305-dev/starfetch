"use client";

import { AlertCircle, CheckCircle2, ChevronRight, FilePenLine, LoaderCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { getCorporateOnboarding, getCorporateOnboardingHistory, getCorporateSnapshotFreshness, getMyCorporateApplications, getSafeErrorMessage, isApiError, updateCorporateDraft } from "@/lib/api/client";
import { getCorporateApplicationDisplay, isCorporateDraftEditable, type CorporateApplicationDiscoveryItem, type CorporateApplicationHistory, type CorporateDraftInput, type CorporateDraftPatch, type CorporateDraftUpdateResult, type CorporateOnboardingRecord, type CorporateSnapshotFreshness } from "@/lib/corporate/application";
import { useAuth } from "@/components/auth/AuthProvider";
import { CorporateVerificationProgress } from "./CorporateVerificationProgress";

type ReadState = "idle" | "loading" | "ready" | "error";
type EditValues = CorporateDraftInput;

function safeReadError(error: unknown, subject: string) {
  if (!isApiError(error)) return `We could not load ${subject}. Please try again.`;
  if (error.code === "NOT_FOUND") return `${subject} is not available to this account.`;
  if (error.code === "RATE_LIMITED") return `${subject} is temporarily rate limited.${error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} seconds.` : " Please try again later."}`;
  return getSafeErrorMessage(error);
}

function safeEditError(error: unknown) {
  if (!isApiError(error)) return "We could not amend the Corporate DRAFT. No details were changed.";
  if (error.code === "FEATURE_UNAVAILABLE" || error.code === "SERVICE_UNAVAILABLE") return "This amendment is temporarily unavailable. No details were changed.";
  if (error.code === "RATE_LIMITED") return `Corporate DRAFT amendment is rate limited.${error.retryAfterSeconds ? ` Please try again in ${error.retryAfterSeconds} seconds.` : " Please try again later."}`;
  return `${getSafeErrorMessage(error)} No details were changed.`;
}

function compactDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleDateString();
}

function EditDraftForm({ onboarding, onUpdated, onConflict }: { onboarding: CorporateOnboardingRecord; onUpdated: (result: CorporateDraftUpdateResult) => Promise<void>; onConflict: () => Promise<void> }) {
  const [values, setValues] = useState<EditValues>(() => ({ ...onboarding.details, taxIdentificationNumber: "" }));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues({
      institutionName: onboarding.details.institutionName,
      dateOfIncorporation: onboarding.details.dateOfIncorporation,
      rcNumber: onboarding.details.rcNumber,
      taxIdentificationNumber: "",
      businessPhoneNumber: onboarding.details.businessPhoneNumber,
      businessEmail: onboarding.details.businessEmail,
    });
    setNotice(null);
    setError(null);
  }, [onboarding.corporateAccountId, onboarding.details.version, onboarding.details.updatedAt]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const name = event.target.name as keyof EditValues;
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setNotice(null);
    setError(null);
  }

  function changedPatch(): CorporateDraftPatch {
    const patch: CorporateDraftPatch = {};
    if (values.institutionName.trim() !== onboarding.details.institutionName) patch.institutionName = values.institutionName.trim();
    if (values.dateOfIncorporation !== onboarding.details.dateOfIncorporation) patch.dateOfIncorporation = values.dateOfIncorporation;
    if (values.rcNumber.trim() !== onboarding.details.rcNumber) patch.rcNumber = values.rcNumber.trim();
    if (values.businessPhoneNumber.trim() !== onboarding.details.businessPhoneNumber) patch.businessPhoneNumber = values.businessPhoneNumber.trim();
    if (values.businessEmail.trim() !== onboarding.details.businessEmail) patch.businessEmail = values.businessEmail.trim();
    if (values.taxIdentificationNumber.trim()) patch.taxIdentificationNumber = values.taxIdentificationNumber.trim();
    return patch;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const patch = changedPatch();
    if (!Object.keys(patch).length) {
      setNotice("There are no changed approved business fields to amend.");
      return;
    }
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const result = await updateCorporateDraft(onboarding.corporateAccountId, onboarding.details.version, patch);
      // TIN is write-only: clear it regardless of the amended field set.
      setValues((current) => ({ ...current, taxIdentificationNumber: "" }));
      await onUpdated(result);
      setNotice("Corporate DRAFT details were amended by the backend. The current authorised details and safe history have been refreshed.");
    } catch (requestError) {
      if (isApiError(requestError) && requestError.code === "CONFLICT") {
        setValues((current) => ({ ...current, taxIdentificationNumber: "" }));
        setError("The details version is no longer current or this application is no longer editable. Fresh authoritative details have been requested; review them before making a new amendment.");
        await onConflict();
      } else {
        setError(safeEditError(requestError));
      }
    } finally {
      setSaving(false);
    }
  }

  return <section className="mt-6 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="corporate-draft-amendment-heading"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-star-100 text-star-700"><FilePenLine size={20} aria-hidden="true" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">O4 secure amendment</p><h2 id="corporate-draft-amendment-heading" className="mt-1 text-lg font-extrabold text-star-900">Amend Corporate DRAFT details</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-star-muted">Only changed approved business fields are sent. This request uses the current backend details version and never submits, verifies, approves or activates the application.</p></div></div><form onSubmit={(event) => { void submit(event); }} className="mt-5 grid gap-4 sm:grid-cols-2"><EditorInput label="Institution name" name="institutionName" value={values.institutionName} onChange={handleChange} className="sm:col-span-2" /><EditorInput label="Date of incorporation" name="dateOfIncorporation" value={values.dateOfIncorporation} onChange={handleChange} type="date" /><EditorInput label="RC number" name="rcNumber" value={values.rcNumber} onChange={handleChange} /><EditorInput label="Business phone number" name="businessPhoneNumber" value={values.businessPhoneNumber} onChange={handleChange} type="tel" /><EditorInput label="Business email" name="businessEmail" value={values.businessEmail} onChange={handleChange} type="email" /><EditorInput label="Replace Tax Identification Number (optional)" name="taxIdentificationNumber" value={values.taxIdentificationNumber} onChange={handleChange} autoComplete="off" className="sm:col-span-2" help="Leave empty to retain the existing encrypted TIN. A replacement TIN is write-only and is never returned." /><div className="sm:col-span-2"><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Saving amendment…</> : "Save changed DRAFT fields"}</button></div></form>{notice ? <p role="status" className="mt-4 rounded-lg border border-[#bfe8ca] bg-[#effbf2] px-4 py-3 text-xs leading-5 text-star-800">{notice}</p> : null}{error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</p> : null}</section>;
}

function EditorInput({ label, name, value, onChange, type = "text", autoComplete, className = "", help }: { label: string; name: keyof EditValues; value: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void; type?: "text" | "date" | "tel" | "email"; autoComplete?: string; className?: string; help?: string }) {
  const id = `corporate-amend-${name}`;
  return <div className={className}><label htmlFor={id} className="mb-2 block text-sm font-bold text-star-900">{label}</label><input id={id} name={name} type={type} value={value} onChange={onChange} autoComplete={autoComplete} className="h-12 w-full rounded-lg border border-star-200 bg-white px-3.5 text-sm text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100" />{help ? <p className="mt-2 text-xs leading-5 text-star-muted">{help}</p> : null}</div>;
}

export function CorporateApplicationsWorkspace() {
  const { status, user } = useAuth();
  const activeUserId = useRef<string | null>(null);
  const discoveryEpoch = useRef(0);
  const detailsEpoch = useRef(0);
  const [accounts, setAccounts] = useState<CorporateApplicationDiscoveryItem[]>([]);
  const [discoveryState, setDiscoveryState] = useState<ReadState>("idle");
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<CorporateOnboardingRecord | null>(null);
  const [history, setHistory] = useState<CorporateApplicationHistory | null>(null);
  const [freshness, setFreshness] = useState<CorporateSnapshotFreshness | null>(null);
  const [detailsState, setDetailsState] = useState<ReadState>("idle");
  const [detailsError, setDetailsError] = useState<string | null>(null);

  async function loadDiscovery(ownerId: string) {
    const epoch = discoveryEpoch.current + 1;
    discoveryEpoch.current = epoch;
    setDiscoveryState("loading");
    setDiscoveryError(null);
    try {
      const discovered = await getMyCorporateApplications();
      if (discoveryEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      setAccounts(discovered);
      setSelectedAccountId((current) => current && discovered.some((item) => item.corporateAccountId === current) ? current : discovered[0]?.corporateAccountId ?? null);
      setDiscoveryState("ready");
    } catch (error) {
      if (discoveryEpoch.current !== epoch || activeUserId.current !== ownerId) return;
      setAccounts([]);
      setSelectedAccountId(null);
      setDiscoveryState("error");
      setDiscoveryError(safeReadError(error, "your Corporate applications"));
    }
  }

  async function loadSelected(ownerId: string, corporateAccountId: string) {
    const epoch = detailsEpoch.current + 1;
    detailsEpoch.current = epoch;
    setDetailsState("loading");
    setDetailsError(null);
    setOnboarding(null);
    setHistory(null);
    setFreshness(null);
    const [onboardingResult, historyResult, freshnessResult] = await Promise.allSettled([
      getCorporateOnboarding(corporateAccountId),
      getCorporateOnboardingHistory(corporateAccountId),
      getCorporateSnapshotFreshness(corporateAccountId),
    ]);
    if (detailsEpoch.current !== epoch || activeUserId.current !== ownerId) return;
    if (onboardingResult.status === "fulfilled") setOnboarding(onboardingResult.value);
    if (historyResult.status === "fulfilled") setHistory(historyResult.value);
    if (freshnessResult.status === "fulfilled") setFreshness(freshnessResult.value);
    const failed = onboardingResult.status === "rejected" ? onboardingResult.reason : historyResult.status === "rejected" ? historyResult.reason : freshnessResult.status === "rejected" ? freshnessResult.reason : null;
    setDetailsState(failed ? "error" : "ready");
    if (failed) setDetailsError(safeReadError(failed, "one or more Corporate application records"));
  }

  useEffect(() => {
    activeUserId.current = status === "authenticated" && user ? user.id : null;
    discoveryEpoch.current += 1;
    detailsEpoch.current += 1;
    setAccounts([]);
    setSelectedAccountId(null);
    setOnboarding(null);
    setHistory(null);
    setFreshness(null);
    setDiscoveryError(null);
    setDetailsError(null);
    setDiscoveryState(status === "authenticated" && user ? "loading" : "idle");
    setDetailsState("idle");
    if (status === "authenticated" && user) void loadDiscovery(user.id);
  }, [status, user?.id]);

  useEffect(() => {
    if (status === "authenticated" && user && selectedAccountId) void loadSelected(user.id, selectedAccountId);
  }, [selectedAccountId, status, user?.id]);

  if (status === "loading" || discoveryState === "loading") return <section className="mt-6 grid min-h-56 place-items-center rounded-xl border border-star-200 bg-white" aria-busy="true"><div className="text-center"><LoaderCircle size={28} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-star-muted">Loading your Corporate applications…</p></div></section>;
  if (discoveryState === "error") return <section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5" role="alert"><div className="flex gap-3"><AlertCircle size={21} className="shrink-0 text-red-700" aria-hidden="true" /><div><h2 className="text-base font-extrabold text-star-900">Corporate applications could not be loaded</h2><p className="mt-1 text-sm leading-6 text-red-700">{discoveryError}</p><button type="button" onClick={() => { if (user) void loadDiscovery(user.id); }} className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-3"><RefreshCw size={15} aria-hidden="true" />Retry discovery</button></div></div></section>;
  if (!accounts.length) return <section className="mt-6 rounded-xl border border-star-200 bg-white p-6 text-center shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><ShieldAlert size={26} className="mx-auto text-star-700" aria-hidden="true" /><p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Corporate applicant dashboard</p><h2 className="mt-2 text-lg font-extrabold text-star-900">No Corporate application is available yet</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-star-muted">You are securely signed in as a Corporate applicant, but the approved owner-scoped discovery API returned no Corporate application for this account. This does not indicate an approved Corporate investment account.</p><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-star-muted">Corporate onboarding is currently unavailable. No company details, TIN or documents are required from this dashboard.</p></section>;

  const selected = accounts.find((item) => item.corporateAccountId === selectedAccountId) ?? accounts[0];
  const refreshSelected = async () => { if (user && selected) await loadSelected(user.id, selected.corporateAccountId); };
  const updateApplied = async () => { await refreshSelected(); };

  return <section className="mt-6" aria-labelledby="corporate-applications-heading"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Owner-scoped Corporate accounts</p><h2 id="corporate-applications-heading" className="mt-1 text-xl font-extrabold text-star-900">Your Corporate applications</h2></div><p className="max-w-md text-xs leading-5 text-star-muted">Only applications initiated by the signed-in investor are returned. Account selection stays in memory and resets when the session changes.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{accounts.map((account, index) => { const display = getCorporateApplicationDisplay(account.status); const selectedCard = account.corporateAccountId === selected.corporateAccountId; return <button key={account.corporateAccountId} type="button" onClick={() => setSelectedAccountId(account.corporateAccountId)} aria-pressed={selectedCard} className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 ${selectedCard ? "border-star-700 bg-star-50" : "border-star-200 bg-white hover:border-star-300"}`}><span className="flex items-start justify-between gap-3"><span><span className="text-sm font-extrabold text-star-900">Corporate application {index + 1}</span><span className="mt-1 block text-xs leading-5 text-star-muted">Updated {compactDate(account.updatedAt)} · details version {account.detailsVersion}</span></span><ChevronRight size={18} className="shrink-0 text-star-700" aria-hidden="true" /></span><span className="mt-3 inline-flex rounded-full bg-star-100 px-2.5 py-1 text-xs font-extrabold text-star-700">{display.label}</span></button>; })}</div>{detailsState === "loading" ? <p className="mt-5 flex items-center gap-2 rounded-lg border border-star-200 bg-star-50 px-4 py-3 text-sm text-star-muted"><LoaderCircle size={16} className="animate-spin text-star-700" aria-hidden="true" />Loading selected application details, history and snapshot freshness…</p> : null}{detailsError ? <div className="mt-5 rounded-lg border border-[#f2d89d] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-star-muted"><AlertCircle size={16} className="mr-2 inline text-star-700" aria-hidden="true" />{detailsError}<button type="button" onClick={() => { void refreshSelected(); }} className="ml-3 font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-2">Retry selected record</button></div> : null}<div className="mt-6"><CorporateVerificationProgress onboarding={onboarding} history={history} snapshotFreshness={freshness} loading={detailsState === "loading"} readError={detailsError} onRetryRead={() => { void refreshSelected(); }} /></div>{onboarding && isCorporateDraftEditable(onboarding.status) ? <EditDraftForm key={`${onboarding.corporateAccountId}-${onboarding.details.version}-${onboarding.details.updatedAt}`} onboarding={onboarding} onUpdated={updateApplied} onConflict={refreshSelected} /> : onboarding ? <section className="mt-6 rounded-xl border border-star-200 bg-star-50 p-5"><h2 className="text-base font-extrabold text-star-900">DRAFT amendment unavailable</h2><p className="mt-1 text-sm leading-6 text-star-muted">Only applications in DRAFT or INFO_REQUESTED can be amended through O4. This lifecycle state has no edit control.</p></section> : null}</section>;
}
