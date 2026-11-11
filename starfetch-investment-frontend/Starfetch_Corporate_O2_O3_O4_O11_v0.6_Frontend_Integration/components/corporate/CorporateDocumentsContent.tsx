"use client";

import { FileQuestion, FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { CorporateVerificationProgress } from "./CorporateVerificationProgress";

export function CorporateDocumentsContent() {
  const { status } = useAuth();

  if (status === "loading") return <main className="grid min-h-[45vh] place-items-center" aria-busy="true"><div className="text-center"><LoaderCircle size={27} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-star-muted">Loading document access…</p></div></main>;

  return (
    <main className="min-w-0" aria-labelledby="corporate-documents-heading">
      <header className="mb-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Tier 2 verification</p><h1 id="corporate-documents-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Document uploads</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-star-muted">Corporate document requirements, statuses and upload permissions are shown only when returned by Starfetch&apos;s approved backend ruleset.</p></header>

      <section className="rounded-xl border border-[#f2d89d] bg-[#fff9e8] p-5" aria-labelledby="document-rules-unavailable-heading"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#fff0c7] text-[#956500]"><FileQuestion size={21} aria-hidden="true" /></span><div><h2 id="document-rules-unavailable-heading" className="text-base font-extrabold text-star-900">Document rules are not available yet</h2><p className="mt-1 text-sm leading-6 text-star-muted">No document category is assumed or marked mandatory. The Corporate document endpoint and ruleset have not been publicly exposed, so secure upload, replacement and resubmission remain disabled.</p></div></div></section>

      <section className="mt-5 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="secure-upload-heading"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="secure-upload-heading" className="text-lg font-extrabold text-star-900">Secure upload</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-star-muted">File selection is disabled until Starfetch can supply authorised document requirements, accepted types, file-size limits and an approved storage operation.</p></div><button type="button" disabled className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-star-100 px-4 text-sm font-extrabold text-star-muted"><FileUp size={17} aria-hidden="true" />Upload unavailable</button></div>
        <div className="mt-5 grid min-h-44 place-items-center rounded-lg border border-dashed border-star-200 bg-star-50 px-5 text-center"><div><ShieldCheck size={26} className="mx-auto text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-extrabold text-star-900">No document is selected or stored</p><p className="mt-1 max-w-md text-xs leading-5 text-star-muted">The browser does not retain corporate documents, sensitive identity records or file metadata while secure upload is unavailable.</p></div></div>
      </section>

      <div className="mt-6"><CorporateVerificationProgress /></div>
    </main>
  );
}
