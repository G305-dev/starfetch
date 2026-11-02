"use client";

import { useState } from "react";
import { Building2, Check, FileCheck2, ShieldCheck, Upload } from "lucide-react";
import { businessVerificationSections } from "./business-account-settings-data";

type VerificationId = "kyc" | "kyb";

export function BusinessAccountSettingsContent() {
  const [prepared, setPrepared] = useState<Record<VerificationId, boolean>>({ kyc: false, kyb: false });
  const [notice, setNotice] = useState("");

  function prepareSection(id: VerificationId) {
    setPrepared((current) => ({ ...current, [id]: true }));
    setNotice(`${id.toUpperCase()} documents are marked ready for review in this frontend preview.`);
  }

  return <main aria-labelledby="business-account-settings-heading"><header><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Business account</p><h1 id="business-account-settings-heading" className="mt-2 font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Account Settings</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Complete your KYC and KYB requirements to finish your business account setup.</p></header>{notice ? <p role="status" className="mt-5 flex items-center gap-2 rounded-lg border border-[#cce7d0] bg-[#eff8f0] px-4 py-3 text-sm font-semibold text-[#16743d]"><Check size={16} strokeWidth={3} aria-hidden="true" />{notice}</p> : null}<div className="mt-6 grid gap-5 xl:grid-cols-2">{businessVerificationSections.map((section) => { const complete = prepared[section.id]; const Icon = section.id === "kyc" ? ShieldCheck : Building2; return <section key={section.id} id={section.id} className="scroll-mt-24 rounded-2xl border border-star-200 bg-white p-5 shadow-[0_3px_14px_rgba(0,59,42,0.045)] sm:p-6" aria-labelledby={`${section.id}-heading`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#e8f6e9] text-star-700"><Icon size={22} aria-hidden="true" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-star-700">{section.acronym}</p><h2 id={`${section.id}-heading`} className="mt-1 text-xl font-extrabold text-star-900">{section.title}</h2></div></div><span className={`rounded-full px-3 py-1 text-xs font-extrabold ${complete ? "bg-[#e1f7e7] text-[#16743d]" : "bg-[#fff4d8] text-[#976800]"}`}>{complete ? "Ready for review" : "Not started"}</span></div><p className="mt-4 text-sm leading-6 text-star-muted">{section.description}</p><div className="mt-5 rounded-xl border border-star-100 bg-star-50 p-4"><h3 className="text-sm font-extrabold text-star-900">What you will need</h3><ul className="mt-3 space-y-2.5">{section.requirements.map((requirement) => <li key={requirement} className="flex gap-2 text-sm leading-5 text-star-muted"><FileCheck2 size={17} className="mt-0.5 shrink-0 text-star-700" aria-hidden="true" />{requirement}</li>)}</ul></div><button type="button" onClick={() => prepareSection(section.id)} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-star-700 px-5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><Upload size={17} aria-hidden="true" />Upload {section.acronym} documents</button><p className="mt-3 text-xs leading-5 text-star-muted">This is a frontend-only document preparation state. No files are uploaded or stored.</p></section>; })}</div></main>;
}
