"use client";

import { Building2, FileText, LoaderCircle, Mail, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { maskCorporateValue } from "@/lib/corporate/application";
import { CorporateVerificationProgress } from "./CorporateVerificationProgress";

function DetailCard({ title, icon: Icon, children }: { title: string; icon: typeof Building2; children: React.ReactNode }) {
  return <section className="rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><div className="flex items-center gap-3 border-b border-star-100 px-5 py-4"><span className="grid size-9 place-items-center rounded-full bg-star-100 text-star-700"><Icon size={18} aria-hidden="true" /></span><h2 className="text-base font-extrabold text-star-900">{title}</h2></div>{children}</section>;
}

export function CorporateProfileContent() {
  const { status, user } = useAuth();

  if (status === "loading") return <main className="grid min-h-[45vh] place-items-center" aria-busy="true"><div className="text-center"><LoaderCircle size={27} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-star-muted">Loading the authenticated applicant…</p></div></main>;

  const applicantName = user ? `${user.firstName} ${user.lastName}`.trim() : "Unavailable";
  const applicantEmail = user?.email ? maskCorporateValue(user.email, 4) : "Unavailable";

  return (
    <main className="min-w-0" aria-labelledby="corporate-profile-heading">
      <header className="mb-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate account</p><h1 id="corporate-profile-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Company profile</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-star-muted">Your owner-scoped Corporate applications can be selected from Overview. Representative, verification-evidence and compliance records are separate approved interfaces and are not exposed here.</p></header>

      <section className="rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="profile-unavailable-heading"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-star-700"><ShieldCheck size={20} aria-hidden="true" /></span><div><h2 id="profile-unavailable-heading" className="text-base font-extrabold text-star-900">Company record unavailable</h2><p className="mt-1 text-sm leading-6 text-star-muted">This portal will not infer company information, representatives, verification or approval from local form entries. Editing is disabled until an authorised versioned profile API is available.</p></div></div></section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <DetailCard title="Canonical company information" icon={Building2}><dl className="grid gap-x-8 gap-y-5 px-5 py-5 sm:grid-cols-2">{["Institution name", "Date of incorporation", "RC number", "Tax Identification Number", "Business phone number", "Business email"].map((label) => <div key={label}><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">{label}</dt><dd className="mt-1.5 text-sm font-semibold text-star-muted">Unavailable until confirmed by the backend</dd></div>)}</dl></DetailCard>
          <DetailCard title="Initiating applicant" icon={UserRound}><dl className="grid gap-5 px-5 py-5 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Authenticated applicant</dt><dd className="mt-1.5 text-sm font-semibold text-star-700">{applicantName}</dd></div><div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Email</dt><dd className="mt-1.5 text-sm font-semibold text-star-700">{applicantEmail}</dd></div></dl><p className="border-t border-star-100 px-5 py-3 text-xs leading-5 text-star-muted">Representative details are shown only when a future approved Corporate record supports them. No additional representative field is required in this portal.</p></DetailCard>
        </div>
        <aside className="space-y-5"><DetailCard title="Profile actions" icon={FileText}><div className="p-5"><p className="text-sm leading-6 text-star-muted">Local-only profile edits are intentionally unavailable. Use the verification and document pages to review the current backend availability.</p><div className="mt-4 grid gap-2"><Link href="/corporate/documents" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-star-200 px-3 text-sm font-extrabold text-star-700 transition hover:bg-star-50"><FileText size={16} aria-hidden="true" />Document requirements</Link><a href="mailto:corporate@starfetchinvestltd.com.ng" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-star-200 px-3 text-sm font-extrabold text-star-700 transition hover:bg-star-50"><Mail size={16} aria-hidden="true" />Contact relationship manager</a></div></div></DetailCard></aside>
      </div>
      <div className="mt-6"><CorporateVerificationProgress /></div>
    </main>
  );
}
