"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, Circle, Eye, FileUp, LoaderCircle, RefreshCw, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  authorizeCorporateKycDocumentView,
  getCorporateKycDocuments,
  getMyCorporateApplications,
  getSafeErrorMessage,
  isApiError,
  submitCorporateApplication,
  uploadCorporateKycDocument,
  type CorporateKycDocumentCategory,
  type CorporateKycDocumentsData,
  type CorporateKycRequirement,
  type CorporateSubmissionBlocker,
  type CorporateSubmissionReceipt,
} from "@/lib/api/client";

type SectionStatus = CorporateKycDocumentsData["section"]["status"];
type LoadPhase = "resolving" | "loading" | "ready" | "no-account" | "error" | "unavailable";

const profileSectionLabels: Record<string, string> = {
  companyDetails: "Company Details",
  investmentProfile: "Investment Profile",
  sourceOfFunds: "Source of Funds",
  bankDetails: "Bank Details",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type CorporateKycReviewStatus = NonNullable<CorporateKycRequirement["currentDocument"]>["reviewStatus"];

function reviewStatusLabel(reviewStatus: CorporateKycReviewStatus) {
  switch (reviewStatus) {
    case "AWAITING_REVIEW": return "Submitted, awaiting Starfetch review";
    case "UNDER_REVIEW": return "Under review";
    case "INFORMATION_REQUESTED": return "Information requested";
    case "REVIEW_COMPLETED": return "Review completed";
    default: return "Not submitted";
  }
}

function blockerLabel(blocker: CorporateSubmissionBlocker, requirements: CorporateKycRequirement[]) {
  if (blocker.kind === "PROFILE_SECTION") return `Complete the ${profileSectionLabels[blocker.key] ?? blocker.key} section.`;
  if (blocker.kind === "DOCUMENT") {
    const requirement = requirements.find((item) => item.category === blocker.key);
    return `Upload the ${requirement?.title ?? blocker.key}.`;
  }
  return `Your application is currently ${blocker.key}.`;
}

function errorMessage(error: unknown, fallback: string) {
  if (!isApiError(error)) return fallback;
  switch (error.code) {
    case "FEATURE_UNAVAILABLE": return "Document upload is temporarily unavailable. Nothing has been stored. Please try again later.";
    case "FILE_TOO_LARGE": return "This file is larger than the maximum allowed size. Please choose a smaller file.";
    case "UNSUPPORTED_FILE_TYPE": return "This file type is not supported. Please upload a PDF, JPEG or PNG file.";
    case "CONFLICT": return "This document or application changed. The latest status has been reloaded — please review and try again.";
    case "RATE_LIMITED": return "Too many requests were made. Please wait a moment and try again.";
    case "UNAUTHENTICATED": return "Your session has ended. Please sign in again.";
    case "CSRF_VALIDATION_FAILED": return "Your session could not be verified securely. Please refresh the page and try again.";
    case "EMAIL_NOT_VERIFIED": return "Please verify your email address before uploading documents.";
    case "NOT_FOUND": return "This document is not available to your account.";
    case "NETWORK_ERROR": return "We could not reach Starfetch securely. Please check your connection and try again.";
    default: return getSafeErrorMessage(error);
  }
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function CorporateDocumentUploadSection({ onBack, onStatusChange }: { onBack: () => void; onStatusChange?: (status: SectionStatus | null) => void }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<LoadPhase>("resolving");
  const [data, setData] = useState<CorporateKycDocumentsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<CorporateKycDocumentCategory, File | null>>>({});
  const [uploadingCategory, setUploadingCategory] = useState<CorporateKycDocumentCategory | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Partial<Record<CorporateKycDocumentCategory, string>>>({});
  const [uploadSuccess, setUploadSuccess] = useState<Partial<Record<CorporateKycDocumentCategory, string>>>({});
  const [viewingCategory, setViewingCategory] = useState<CorporateKycDocumentCategory | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<CorporateSubmissionReceipt | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const applyData = useCallback((next: CorporateKycDocumentsData) => {
    setData(next);
    onStatusChange?.(next.section.status);
  }, [onStatusChange]);

  const load = useCallback(async () => {
    setPhase("resolving");
    setLoadError(null);
    try {
      const discovered = await getMyCorporateApplications();
      const account = discovered[0];
      if (!account) {
        if (mountedRef.current) { setPhase("no-account"); onStatusChange?.(null); }
        return;
      }
      if (mountedRef.current) setPhase("loading");
      const documents = await getCorporateKycDocuments(account.corporateAccountId);
      if (!mountedRef.current) return;
      applyData(documents);
      setPhase("ready");
    } catch (error) {
      if (!mountedRef.current) return;
      if (isApiError(error) && error.code === "FEATURE_UNAVAILABLE") {
        setPhase("unavailable");
        setLoadError("Document upload is temporarily unavailable. Nothing has been stored. Please try again later.");
      } else {
        setPhase("error");
        setLoadError(errorMessage(error, "We could not load your document requirements. Please try again."));
      }
      onStatusChange?.(null);
    }
  }, [applyData, onStatusChange]);

  useEffect(() => {
    void load();
  }, [load, user?.id]);

  function handleFileSelect(category: CorporateKycDocumentCategory, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFiles((current) => ({ ...current, [category]: file }));
    setUploadErrors((current) => ({ ...current, [category]: undefined }));
    setUploadSuccess((current) => ({ ...current, [category]: undefined }));
    event.target.value = "";
  }

  function validateFile(requirement: CorporateKycRequirement, file: File): string | null {
    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!requirement.acceptedExtensions.some((item) => item.toLowerCase() === extension)) {
      return `Please choose a file with one of these extensions: ${requirement.acceptedExtensions.join(", ")}.`;
    }
    if (file.size < 1) return "The selected file is empty. Please choose a different file.";
    if (file.size > requirement.maxSizeBytes) return `This file is larger than the maximum allowed size of ${formatBytes(requirement.maxSizeBytes)}.`;
    return null;
  }

  async function handleUpload(requirement: CorporateKycRequirement) {
    if (!data) return;
    const file = selectedFiles[requirement.category];
    if (!file) {
      setUploadErrors((current) => ({ ...current, [requirement.category]: "Choose a file to upload." }));
      return;
    }
    const validationError = validateFile(requirement, file);
    if (validationError) {
      setUploadErrors((current) => ({ ...current, [requirement.category]: validationError }));
      return;
    }
    setUploadingCategory(requirement.category);
    setUploadErrors((current) => ({ ...current, [requirement.category]: undefined }));
    setUploadSuccess((current) => ({ ...current, [requirement.category]: undefined }));
    try {
      const replacesDocumentId = requirement.currentDocument?.documentId;
      const updated = await uploadCorporateKycDocument(data.corporateAccountId, requirement.category, file, replacesDocumentId);
      if (!mountedRef.current) return;
      applyData(updated);
      setSelectedFiles((current) => ({ ...current, [requirement.category]: null }));
      setUploadSuccess((current) => ({ ...current, [requirement.category]: `${requirement.currentDocument ? "Replacement" : "Upload"} successful. The document is saved to your application.` }));
    } catch (error) {
      if (!mountedRef.current) return;
      setUploadErrors((current) => ({ ...current, [requirement.category]: errorMessage(error, "We could not upload this document. Please try again.") }));
      if (isApiError(error) && (error.code === "CONFLICT" || error.code === "FEATURE_UNAVAILABLE")) {
        try {
          const refreshed = await getCorporateKycDocuments(data.corporateAccountId);
          if (mountedRef.current) applyData(refreshed);
        } catch {
          // Keep the original upload error visible; the next manual refresh will resync.
        }
      }
    } finally {
      if (mountedRef.current) setUploadingCategory(null);
    }
  }

  async function handleView(requirement: CorporateKycRequirement) {
    const currentDocument = requirement.currentDocument;
    if (!data || !currentDocument) return;
    setViewingCategory(requirement.category);
    setViewError(null);
    try {
      const grant = await authorizeCorporateKycDocumentView(data.corporateAccountId, currentDocument.documentId);
      // The signed URL is short-lived and must never be stored or logged.
      window.location.assign(grant.viewUrl);
    } catch (error) {
      if (mountedRef.current) setViewError(errorMessage(error, "We could not open this document. Please try again."));
    } finally {
      if (mountedRef.current) setViewingCategory(null);
    }
  }

  async function handleSubmit() {
    if (!data || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey();
      const result = await submitCorporateApplication(data.corporateAccountId, idempotencyKeyRef.current);
      if (!mountedRef.current) return;
      setReceipt(result);
      idempotencyKeyRef.current = null;
      try {
        const refreshed = await getCorporateKycDocuments(data.corporateAccountId);
        if (mountedRef.current) applyData(refreshed);
      } catch {
        // The submission succeeded; the receipt above is authoritative.
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setSubmitError(errorMessage(error, "We could not submit your application. Please try again."));
      // Resync so blockers or an already-submitted state are shown truthfully.
      try {
        const refreshed = await getCorporateKycDocuments(data.corporateAccountId);
        if (mountedRef.current) applyData(refreshed);
      } catch {
        // Keep the original submit error visible.
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  const alreadySubmitted = Boolean(receipt) || Boolean(data?.submission.submissionId) || (data?.applicationStatus !== "DRAFT" && data?.applicationStatus !== "INFO_REQUESTED");
  const submissionReference = receipt?.submissionId ?? data?.submission.submissionId ?? null;
  const submittedAt = receipt?.submittedAt ?? data?.submission.submittedAt ?? null;

  return (
    <div className="p-5 sm:p-6">
      {phase === "resolving" || phase === "loading" ? (
        <p className="flex items-center gap-2 rounded-lg border border-star-200 bg-star-50 px-4 py-3 text-sm text-star-muted" role="status"><LoaderCircle size={16} className="animate-spin text-star-700" aria-hidden="true" />Loading your document requirements…</p>
      ) : null}

      {phase === "no-account" ? (
        <section className="rounded-xl border border-star-200 bg-star-50 p-5" role="status">
          <div className="flex items-start gap-3"><ShieldCheck size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><div><h3 className="text-base font-extrabold text-star-900">No Corporate application found</h3><p className="mt-1 text-sm leading-6 text-star-muted">Document upload is available once a Corporate application exists for this account. Please complete the application setup first.</p></div></div>
        </section>
      ) : null}

      {phase === "error" || phase === "unavailable" ? (
        <section className="rounded-xl border border-[#f2d89d] bg-[#fff9e8] p-5" role="alert">
          <div className="flex items-start gap-3"><AlertCircle size={21} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" /><div><h3 className="text-base font-extrabold text-star-900">{phase === "unavailable" ? "Document upload is temporarily unavailable" : "We could not load your documents"}</h3><p className="mt-1 text-sm leading-6 text-star-muted">{loadError}</p></div></div>
          <button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50"><RefreshCw size={16} aria-hidden="true" />Try again</button>
        </section>
      ) : null}

      {phase === "ready" && data ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-star-200 bg-star-50 px-4 py-3">
            <p className="text-sm font-bold text-star-900">{data.section.uploadedCount} of {data.section.requiredCount} mandatory documents uploaded</p>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${data.section.status === "COMPLETE" ? "bg-[#e6f6ec] text-[#16743d]" : "bg-white text-star-700"}`}>
              {data.section.status === "COMPLETE" ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              {data.section.status === "COMPLETE" ? "Section complete" : data.section.status === "DRAFT" ? "In progress" : "Not started"}
            </span>
          </div>

          <div className="space-y-4">
            {data.requirements.map((requirement) => {
              const selectedFile = selectedFiles[requirement.category] ?? null;
              const uploading = uploadingCategory === requirement.category;
              const viewing = viewingCategory === requirement.category;
              const error = uploadErrors[requirement.category];
              const success = uploadSuccess[requirement.category];
              const blocked = requirement.blockedReason === "APPLICATION_NOT_EDITABLE";
              const canAct = !blocked && (requirement.currentDocument ? requirement.canReplace : requirement.canUpload);
              const inputId = `corporate-document-${requirement.category}`;
              return (
                <article key={requirement.category} className="rounded-xl border border-star-200 bg-white p-5" aria-labelledby={`${inputId}-title`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 id={`${inputId}-title`} className="text-base font-extrabold text-star-900">{requirement.title} <span className="ml-1 rounded-md bg-star-100 px-2 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-star-700">Mandatory</span></h3>
                      <p className="mt-1 text-sm leading-6 text-star-muted">{requirement.description}</p>
                      <p className="mt-1 text-xs leading-5 text-star-muted">Accepted: {requirement.acceptedExtensions.join(", ")} · Maximum size: {formatBytes(requirement.maxSizeBytes)}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${requirement.uploadStatus === "UPLOADED" ? "bg-[#e6f6ec] text-[#16743d]" : "bg-[#fff9e8] text-star-700"}`}>
                      {requirement.uploadStatus === "UPLOADED" ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
                      {requirement.uploadStatus === "UPLOADED" ? "Uploaded" : "Missing"}
                    </span>
                  </div>

                  {requirement.currentDocument ? (
                    <dl className="mt-4 grid gap-3 rounded-lg border border-star-100 bg-star-50 px-4 py-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Saved file</dt><dd className="mt-1 break-words font-semibold text-star-800">{requirement.currentDocument.displayFilename}</dd></div>
                      <div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Version</dt><dd className="mt-1 font-semibold text-star-800">v{requirement.currentDocument.version} · {formatBytes(requirement.currentDocument.sizeBytes)}</dd></div>
                      <div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Uploaded</dt><dd className="mt-1 font-semibold text-star-800">{formatDateTime(requirement.currentDocument.uploadedAt)}</dd></div>
                      <div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Review status</dt><dd className="mt-1 font-semibold text-star-800">{reviewStatusLabel(requirement.currentDocument.reviewStatus)}</dd></div>
                    </dl>
                  ) : (
                    <p className="mt-4 rounded-lg border border-[#f2d89d] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-star-muted" role="status">This mandatory document has not been uploaded yet.</p>
                  )}

                  {blocked ? (
                    <p className="mt-4 rounded-lg border border-star-200 bg-star-50 px-4 py-3 text-sm leading-6 text-star-muted" role="status">Your application is no longer editable, so documents cannot be uploaded or replaced.</p>
                  ) : (
                    <div className="mt-4">
                      <label htmlFor={inputId} className="mb-2 block text-sm font-bold text-star-900">{requirement.currentDocument ? "Replace this document" : "Choose a file"} <span className="ml-1 text-star-700" aria-hidden="true">*</span></label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input id={inputId} type="file" accept={requirement.acceptedExtensions.join(",")} disabled={!canAct || uploading} onChange={(event) => handleFileSelect(requirement.category, event)} className="min-h-11 flex-1 rounded-lg border border-star-200 bg-white px-3 py-2 text-sm text-star-900 file:mr-3 file:rounded-md file:border-0 file:bg-star-50 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-star-700 disabled:cursor-not-allowed disabled:opacity-55 focus:border-star-700 focus:outline-none focus:ring-2 focus:ring-star-100" aria-describedby={selectedFile ? `${inputId}-selected` : undefined} />
                        <button type="button" onClick={() => void handleUpload(requirement)} disabled={!canAct || uploading || !selectedFile} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-lime px-5 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
                          {uploading ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <UploadCloud size={16} aria-hidden="true" />}
                          {uploading ? "Uploading…" : requirement.currentDocument ? "Replace document" : "Upload document"}
                        </button>
                        {requirement.currentDocument ? (
                          <button type="button" onClick={() => void handleView(requirement)} disabled={viewing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50 disabled:cursor-not-allowed disabled:opacity-55">
                            {viewing ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                            {viewing ? "Opening…" : "View saved file"}
                          </button>
                        ) : null}
                      </div>
                      {selectedFile ? <p id={`${inputId}-selected`} className="mt-2 text-xs leading-5 text-star-muted">Selected: <span className="font-semibold text-star-800">{selectedFile.name}</span> ({formatBytes(selectedFile.size)})</p> : null}
                      {uploading ? <p className="mt-2 flex items-center gap-2 text-xs leading-5 text-star-muted" role="status"><LoaderCircle size={14} className="animate-spin text-star-700" aria-hidden="true" />Uploading {selectedFile?.name ?? "document"}…</p> : null}
                      {error ? <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium leading-5 text-red-700" role="alert">{error}</p> : null}
                      {success ? <p className="mt-2 rounded-lg border border-[#bfe8ca] bg-[#effbf2] px-3 py-2 text-xs font-medium leading-5 text-star-800" role="status">{success}</p> : null}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {viewError ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">{viewError}</p> : null}

          <section className="rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="corporate-submission-heading">
            <h3 id="corporate-submission-heading" className="text-base font-extrabold text-star-900">Review &amp; submit for review</h3>
            {alreadySubmitted ? (
              <div className="mt-3 rounded-lg border border-[#bfe8ca] bg-[#effbf2] px-4 py-3" role="status">
                <p className="flex items-start gap-2 text-sm font-bold text-star-900"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[#16743d]" aria-hidden="true" />Submitted for Starfetch review</p>
                <p className="mt-1 text-sm leading-6 text-star-muted">Your application has been submitted and is awaiting Starfetch review. {submissionReference ? <>Reference: <span className="font-bold text-star-900">{submissionReference}</span></> : null} {submittedAt ? <>· Submitted {formatDateTime(submittedAt)}</> : null}</p>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm leading-6 text-star-muted">When all five sections are complete and the three mandatory documents are uploaded, submit your application for Starfetch review.</p>
                {data.submission.blockers.length ? (
                  <div className="mt-3 rounded-lg border border-[#f2d89d] bg-white px-4 py-3">
                    <p className="text-sm font-extrabold text-star-900">Still needed before submission:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-star-muted">
                      {data.submission.blockers.map((blocker, index) => <li key={`${blocker.kind}-${blocker.key}-${index}`}>{blockerLabel(blocker, data.requirements)}</li>)}
                    </ul>
                  </div>
                ) : null}
                {submitError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="alert">{submitError}</p> : null}
                <button type="button" onClick={() => void handleSubmit()} disabled={!data.submission.canSubmit || submitting} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">
                  {submitting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                  {submitting ? "Submitting…" : "Submit Corporate KYC for review"}
                </button>
                {!data.submission.canSubmit ? <p className="mt-2 text-xs leading-5 text-star-muted">Submission becomes available once every blocker above is cleared.</p> : null}
              </>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-star-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50"><ArrowLeft size={16} aria-hidden="true" />Previous section</button>
            <p className="flex items-start gap-2 text-xs leading-5 text-star-muted"><FileUp size={15} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" />Uploaded documents are saved to your application and shown here when you return. Files are stored privately by Starfetch; only the saved file name, version and status are shown.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
