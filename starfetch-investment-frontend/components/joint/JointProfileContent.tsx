"use client";

import { useState } from "react";
import { ArrowRight, BarChart3, CalendarDays, CheckCircle2, CircleAlert, Clock3, Coins, FileText, Landmark, Mail, Pencil, Phone, Scale, ShieldCheck, UserRound, UsersRound, X, type LucideIcon } from "lucide-react";
import { jointProfile, jointProfileSections, type JointProfileApplicant, type JointProfileSection, type JointProfileSectionStatus } from "./joint-profile-data";

const statusClasses: Record<JointProfileSectionStatus, string> = {
  Completed: "bg-[#e1f7e7] text-[#16743d]",
  Pending: "bg-[#fff3d9] text-[#9a6200]",
  "Action Required": "bg-[#fde8e8] text-[#b42318]",
};

const statusIcons: Record<JointProfileSectionStatus, LucideIcon> = {
  Completed: CheckCircle2,
  Pending: Clock3,
  "Action Required": CircleAlert,
};

const profileSectionIcons: Record<JointProfileSection["id"], LucideIcon> = {
  "personal-details": UserRound,
  "identity-verification": ShieldCheck,
  "next-of-kin": UsersRound,
  "investment-profile": BarChart3,
  "source-of-funds": Coins,
  "bank-details": Landmark,
  "pep-declaration": Scale,
  documents: FileText,
};

type ProfileAction = { title: string; description: string };

function StatusBadge({ status }: { status: JointProfileSectionStatus }) {
  const Icon = statusIcons[status];
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClasses[status]}`}><Icon size={14} aria-hidden="true" />{status}</span>;
}

function ProfileActionModal({ action, onClose }: { action: ProfileAction; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="joint-profile-action-title"><button type="button" onClick={onClose} aria-label="Close profile action" className="absolute inset-0 bg-star-900/55" /><section className="relative z-10 w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-star-700">Joint profile</p><h2 id="joint-profile-action-title" className="mt-2 text-xl font-extrabold text-star-900">{action.title}</h2></div><button type="button" onClick={onClose} aria-label="Close profile action" className="grid size-10 shrink-0 place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><X size={20} aria-hidden="true" /></button></div><p className="mt-5 text-sm leading-6 text-star-muted">{action.description}</p><div className="mt-5 rounded-lg border border-[#cce7d0] bg-[#eff8f0] p-4"><p className="text-sm font-extrabold text-star-900">Frontend-only placeholder</p><p className="mt-1.5 text-sm leading-6 text-star-muted">Profile updates and verification workflows will be connected when the backend services are available.</p></div><button type="button" onClick={onClose} className="mt-5 w-full rounded-md bg-star-700 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Close</button></section></div>;
}

function ProfileCompletion() {
  const completion = jointProfile.profileCompletion;
  return <section className="mt-6 rounded-xl border border-[#d9eac8] bg-[linear-gradient(115deg,#f3f9e9_0%,#e7f4dc_100%)] p-5 sm:p-6" aria-labelledby="joint-profile-completion-heading"><div className="flex flex-col gap-5 lg:flex-row lg:items-center"><div className="flex items-center gap-5"><div className="grid size-[86px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#168348 0 ${completion.percentage}%, #d7f3c2 ${completion.percentage}% 100%)` }}><div className="grid size-[66px] place-items-center rounded-full bg-white text-xl font-extrabold text-star-900">{completion.percentage}%</div></div><div><h2 id="joint-profile-completion-heading" className="text-xl font-extrabold text-star-900">{completion.title}</h2><p className="mt-1 max-w-xl text-sm leading-6 text-star-muted">{completion.description}</p></div></div><div className="lg:ml-auto lg:w-[360px] lg:border-l lg:border-[#aecba9] lg:pl-7"><p className="text-sm font-extrabold text-star-900">{completion.completedLabel}</p><div className="mt-3 h-3 overflow-hidden rounded-full bg-[#d7f3c2]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#087b4c,#168348)]" style={{ width: `${completion.percentage}%` }} /></div></div></div></section>;
}

function ApplicantCard({ applicant, onEdit }: { applicant: JointProfileApplicant; onEdit: (applicant: JointProfileApplicant) => void }) {
  return <article className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-star-900 text-base font-extrabold text-white">{applicant.initials}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-extrabold text-star-900">{applicant.fullName}</h3><span className="rounded-full bg-star-100 px-2.5 py-1 text-xs font-extrabold text-star-700">{applicant.label}</span></div><div className="mt-3 space-y-2 text-sm text-star-muted"><p className="flex items-center gap-2"><Mail size={16} className="shrink-0 text-star-700" aria-hidden="true" /><span className="truncate">{applicant.email}</span></p><p className="flex items-center gap-2"><Phone size={16} className="shrink-0 text-star-700" aria-hidden="true" />{applicant.phone}</p><p className="flex items-center gap-2"><CalendarDays size={16} className="shrink-0 text-star-700" aria-hidden="true" />{applicant.dateOfBirth}</p></div></div></div><div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end"><span className="inline-flex items-center gap-1.5 rounded-full bg-[#e1f7e7] px-2.5 py-1 text-xs font-extrabold text-[#16743d]"><CheckCircle2 size={14} aria-hidden="true" />{applicant.profileStatus}</span><button type="button" onClick={() => onEdit(applicant)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-star-200 px-3.5 text-sm font-extrabold text-star-700 transition hover:border-star-700 hover:bg-star-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><Pencil size={16} aria-hidden="true" />Edit Details</button></div></div></article>;
}

function ProfileSectionCard({ section, onOpen }: { section: JointProfileSection; onOpen: (section: JointProfileSection) => void }) {
  const Icon = profileSectionIcons[section.id];
  return <button type="button" onClick={() => onOpen(section)} className={`flex min-h-[102px] w-full items-center gap-4 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:p-5 ${section.status === "Completed" ? "border-[#d9eac8] bg-[linear-gradient(115deg,#fcfef8_0%,#f4faed_100%)] hover:border-[#a9cf9e]" : "border-star-200 bg-white hover:border-star-300 hover:shadow-[0_4px_14px_rgba(14,62,46,0.05)]"}`}><span className="grid size-11 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><Icon size={23} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-base font-extrabold text-star-900">{section.title}</span><span className="mt-1 block text-sm leading-5 text-star-muted">{section.description}</span></span><span className="hidden shrink-0 items-center gap-3 sm:flex"><StatusBadge status={section.status} /><ArrowRight size={19} className="text-star-900" aria-hidden="true" /></span><ArrowRight size={19} className="shrink-0 text-star-900 sm:hidden" aria-hidden="true" /></button>;
}

export function JointProfileContent() {
  const [action, setAction] = useState<ProfileAction | null>(null);
  const openApplicantEditor = (applicant: JointProfileApplicant) => setAction({ title: `Edit ${applicant.label}`, description: `Review the frontend-only profile details for ${applicant.fullName}.` });
  const openSection = (section: JointProfileSection) => setAction({ title: section.title, description: section.description });
  const accountHolders = [jointProfile.applicant1, jointProfile.applicant2] as const;

  return <main><section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-4"><span className="mt-1 grid size-12 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><UsersRound size={25} aria-hidden="true" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account settings</p><h1 className="mt-1 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Joint Profile</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Manage your joint account information, verification and investment preferences.</p></div></div><button type="button" onClick={() => setAction({ title: "Edit Account Holders", description: "Review both account holders in this frontend-only joint profile experience." })} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-star-700 bg-white px-5 text-sm font-extrabold text-star-700 transition hover:bg-star-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><Pencil size={18} aria-hidden="true" />Edit Account Holders</button></section><ProfileCompletion /><section className="mt-6" aria-labelledby="account-holders-heading"><div className="flex items-center gap-3"><UsersRound size={24} className="text-star-700" aria-hidden="true" /><h2 id="account-holders-heading" className="text-xl font-extrabold text-star-900">Account Holders</h2></div><div className="mt-4 grid gap-5 xl:grid-cols-2">{accountHolders.map((applicant) => <ApplicantCard key={applicant.id} applicant={applicant} onEdit={openApplicantEditor} />)}</div></section><section className="mt-7" aria-labelledby="joint-information-heading"><div className="flex items-center gap-3"><FileText size={24} className="text-star-700" aria-hidden="true" /><h2 id="joint-information-heading" className="text-xl font-extrabold text-star-900">Joint Account Information</h2></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{jointProfileSections.map((section) => <ProfileSectionCard key={section.id} section={section} onOpen={openSection} />)}</div></section><section className="mt-6 flex flex-col gap-4 rounded-xl border border-[#d9eac8] bg-[linear-gradient(115deg,#fbfdf5_0%,#eff8e8_100%)] p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="joint-mandate-heading"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><Scale size={24} aria-hidden="true" /></span><div><h2 id="joint-mandate-heading" className="text-xl font-extrabold text-star-900">Account Mandate / Signing Rule</h2><p className="mt-1 text-sm leading-6 text-star-muted">{jointProfile.signingMandate.description}</p></div></div><span className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[#dff5c9] px-3.5 py-2 text-sm font-extrabold text-star-900 sm:self-auto"><Scale size={17} className="text-star-700" aria-hidden="true" />{jointProfile.signingMandate.selected}</span></section>{action ? <ProfileActionModal action={action} onClose={() => setAction(null)} /> : null}</main>;
}
