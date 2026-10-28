"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  Eye,
  FileText,
  KeyRound,
  Landmark,
  LockKeyhole,
  MapPin,
  Pencil,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import {
  bankDetails as initialBank,
  identityInfo,
  investmentPreferences as initialPreferences,
  personalDocuments,
  personalInfo as initialPersonal,
  profileCompletion,
  type BankDetails,
  type InvestmentPreferences,
  type PersonalInfo,
} from "./profile-data";

type ProfileSection = "profile" | "verification" | "bank" | "pin" | "password" | "preferences" | "documents";
type EditableSection = "profile" | "bank" | "preferences" | null;

type FieldEntry = { label: string; value: string };

const profileNavigation: Array<{ id: ProfileSection; label: string; icon: typeof UserRound }> = [
  { id: "profile", label: "Profile Details", icon: UserRound },
  { id: "verification", label: "Account Verification", icon: BadgeCheck },
  { id: "bank", label: "Bank Details", icon: Landmark },
  { id: "pin", label: "PIN Management", icon: KeyRound },
  { id: "password", label: "Password Management", icon: LockKeyhole },
  { id: "preferences", label: "Investment Preferences", icon: Building2 },
  { id: "documents", label: "Documents", icon: FileText },
];

function profileFields(personal: PersonalInfo): FieldEntry[] {
  const [firstName = "Profile", ...remaining] = personal.fullName.split(" ");
  return [
    { label: "First Name", value: firstName },
    { label: "Last Name", value: remaining.join(" ") || "Holder" },
    { label: "Phone Number", value: personal.phone },
    { label: "Email Address", value: personal.email },
    { label: "Residential Address", value: personal.address },
    { label: "City", value: personal.city },
    { label: "State", value: personal.state },
    { label: "Country", value: personal.country },
    { label: "Date of Birth", value: personal.dateOfBirth },
    { label: "Occupation", value: personal.occupation },
  ];
}

function EditButton({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-star-200 bg-white px-4 text-sm font-extrabold text-star-900 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><Pencil size={16} aria-hidden="true" />Edit details</button>;
}

function Panel({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_3px_14px_rgba(0,59,42,0.045)] sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-[clamp(1.45rem,2.5vw,2rem)] font-extrabold tracking-[-0.04em] text-star-900">{title}</h1><p className="mt-1.5 text-sm leading-6 text-star-muted">{description}</p></div>{action}</div>{children}</section>;
}

function FieldGrid({ fields }: { fields: FieldEntry[] }) {
  return <dl className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">{fields.map((field) => <div key={field.label} className="min-h-[94px] rounded-xl bg-[#f8faf8] px-5 py-4"><dt className="text-xs font-extrabold uppercase tracking-[0.07em] text-star-muted">{field.label}</dt><dd className="mt-3 break-words text-base font-extrabold text-star-900">{field.value}</dd></div>)}</dl>;
}

function EditForm({ fields, onSave, onCancel }: { fields: FieldEntry[]; onSave: (entries: FieldEntry[]) => void; onCancel: () => void }) {
  const [entries, setEntries] = useState(fields);
  function submit(event: FormEvent) { event.preventDefault(); onSave(entries); }
  return <form onSubmit={submit} className="mt-7"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{entries.map((field, index) => <label key={field.label} className="block"><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.06em] text-star-700">{field.label}</span><input required value={field.value} onChange={(event) => setEntries((all) => all.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} className="min-h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label>)}</div><div className="mt-6 flex flex-col-reverse gap-2 border-t border-star-100 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="min-h-10 rounded-md border border-star-200 px-4 text-sm font-extrabold text-star-700 hover:bg-star-50">Cancel</button><button type="submit" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white hover:bg-star-800"><Save size={16} aria-hidden="true" />Save changes</button></div></form>;
}

function ProfileIdentity({ personal, onPhoto }: { personal: PersonalInfo; onPhoto: (file: File | undefined) => void }) {
  const initials = personal.fullName.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase();
  return <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_3px_14px_rgba(0,59,42,0.045)]"><div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left"><span className="grid size-[84px] shrink-0 place-items-center rounded-full border border-star-200 bg-star-100 text-xl font-extrabold text-star-700">{initials}</span><div className="min-w-0 flex-1"><p className="truncate text-base font-extrabold uppercase tracking-[0.02em] text-star-900">{personal.fullName}</p><p className="mt-1 truncate text-sm text-star-muted">{personal.email}</p></div></div><label className="mt-5 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-star-200 px-3 text-sm font-extrabold text-star-900 transition hover:bg-star-50 focus-within:ring-2 focus-within:ring-star-700"><Upload size={16} aria-hidden="true" />Change Photo<input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(event) => onPhoto(event.target.files?.[0])} /></label><p className="mt-2 text-center text-xs text-star-muted">JPG, PNG (Max 5MB)</p></section>;
}

function AccountNavigation({ active, onSelect }: { active: ProfileSection; onSelect: (section: ProfileSection) => void }) {
  return <section><h2 className="mb-3 text-sm font-extrabold text-star-muted">Account Settings</h2><nav className="overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_3px_14px_rgba(0,59,42,0.045)]" aria-label="Profile account settings">{profileNavigation.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => onSelect(id)} aria-current={active === id ? "page" : undefined} className={`flex min-h-[64px] w-full items-center gap-3 border-b border-star-100 px-4 text-left transition last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-star-700 ${active === id ? "bg-star-50 text-star-900" : "text-star-700 hover:bg-star-50"}`}><span className={`grid size-9 place-items-center rounded-full ${active === id ? "bg-[#e4f7e8] text-[#168348]" : "bg-star-50 text-star-700"}`}><Icon size={19} aria-hidden="true" /></span><span className="flex-1 text-sm font-extrabold">{label}</span><ChevronRight size={19} aria-hidden="true" /></button>)}</nav></section>;
}

function VerificationContent() {
  return <Panel title="Account Verification" description="Review the profile details and documents held for your account."><div className="mt-7 rounded-xl border border-[#cce7d0] bg-[#eff8f0] p-5"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#168348] text-white"><ShieldCheck size={22} aria-hidden="true" /></span><div><h2 className="text-base font-extrabold text-star-900">Profile verification complete</h2><p className="mt-1 text-sm leading-6 text-star-muted">Your profile has been verified and is up to date. This frontend preview can also support incomplete, pending review and action-required states.</p></div></div></div><h2 className="mt-7 text-base font-extrabold text-star-900">Profile Completion</h2><div className="mt-3 flex items-center gap-3"><div className="h-3 flex-1 overflow-hidden rounded-full bg-star-100"><div className="h-full w-full rounded-full bg-[#118466]" /></div><span className="font-extrabold text-star-900">100%</span></div><ul className="mt-6 space-y-3">{profileCompletion.map((label) => <li key={label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2.5 text-sm text-star-muted"><span className="grid size-5 place-items-center rounded-full bg-[#e1f7e7] text-[#168348]"><Check size={12} strokeWidth={3} /></span>{label}</span><span className="rounded-full bg-[#e1f7e7] px-2.5 py-1 text-xs font-bold text-[#16743d]">Completed</span></li>)}</ul></Panel>;
}

function DocumentsContent() {
  return <Panel title="Documents" description="Personal documents held for profile and compliance requirements."><div className="mt-7 divide-y divide-star-100 rounded-lg border border-star-200">{personalDocuments.map((document) => <div key={document.name} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-3 text-sm font-extrabold text-star-900"><FileText size={18} className="text-star-700" />{document.name}</span><span className={`inline-flex w-max items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${document.status === "Verified" ? "bg-[#e1f7e7] text-[#16743d]" : "bg-[#eff2f3] text-[#62717b]"}`}><Check size={12} aria-hidden="true" />{document.status}</span></div>)}</div></Panel>;
}

function SecurityContent({ type, onNotice }: { type: "PIN" | "Password"; onNotice: (message: string) => void }) {
  const isPin = type === "PIN";
  return <Panel title={`${type} Management`} description={isPin ? "Manage your transaction security PIN." : "Keep your account secure with a strong password."}><div className="mt-7 rounded-xl border border-star-200 bg-star-50 p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-star-700">{isPin ? <KeyRound size={20} /> : <LockKeyhole size={20} />}</span><div><h2 className="font-extrabold text-star-900">{isPin ? "Transaction PIN" : "Account password"}</h2><p className="mt-1 text-sm leading-6 text-star-muted">{isPin ? "Your PIN is protected and cannot be viewed." : "Password updates are not connected to a backend in this frontend preview."}</p></div></div><button type="button" onClick={() => onNotice(`${isPin ? "PIN" : "Password"} changes are unavailable in this frontend-only preview.`)} className="mt-5 min-h-10 rounded-md border border-star-200 bg-white px-4 text-sm font-extrabold text-star-900 hover:bg-star-50">Change {type}</button></div></Panel>;
}

export function IndividualProfileContent() {
  const [active, setActive] = useState<ProfileSection>("profile");
  const [personal, setPersonal] = useState(initialPersonal);
  const [bank, setBank] = useState(initialBank);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [editing, setEditing] = useState<EditableSection>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const personalFieldValues = useMemo(() => profileFields(personal), [personal]);
  const bankFieldValues: FieldEntry[] = [{ label: "Bank Name", value: bank.bankName }, { label: "Account Number", value: bank.accountNumber }, { label: "Account Name", value: bank.accountName }, { label: "Account Type", value: bank.accountType }, { label: "BVN", value: bank.bvn }];
  const preferenceFieldValues: FieldEntry[] = [{ label: "Investment Objective", value: preferences.objective }, { label: "Risk Appetite", value: preferences.risk }, { label: "Preferred Investment Products", value: preferences.products }, { label: "Investment Horizon", value: preferences.horizon }];

  function savePersonal(fields: FieldEntry[]) { setPersonal((current) => ({ ...current, fullName: `${fields[0].value} ${fields[1].value}`.trim(), phone: fields[2].value, email: fields[3].value, address: fields[4].value, city: fields[5].value, state: fields[6].value, country: fields[7].value, dateOfBirth: fields[8].value, occupation: fields[9].value })); setEditing(null); setNotice("Profile details saved locally in this frontend preview."); }
  function saveBank(fields: FieldEntry[]) { setBank({ bankName: fields[0].value, accountNumber: fields[1].value, accountName: fields[2].value, accountType: fields[3].value, bvn: fields[4].value }); setEditing(null); setNotice("Bank details saved locally in this frontend preview."); }
  function savePreferences(fields: FieldEntry[]) { setPreferences({ objective: fields[0].value, risk: fields[1].value, products: fields[2].value, horizon: fields[3].value }); setEditing(null); setNotice("Investment preferences saved locally in this frontend preview."); }

  let content: React.ReactNode;
  if (active === "profile") content = <Panel title="Profile Details" description="Manage your personal information and contact details." action={editing !== "profile" ? <EditButton onClick={() => setEditing("profile")} /> : undefined}>{editing === "profile" ? <EditForm fields={personalFieldValues} onSave={savePersonal} onCancel={() => setEditing(null)} /> : <FieldGrid fields={personalFieldValues} />}</Panel>;
  else if (active === "verification") content = <VerificationContent />;
  else if (active === "bank") content = <Panel title="Bank Details" description="Manage your linked settlement account details." action={editing !== "bank" ? <EditButton onClick={() => setEditing("bank")} /> : undefined}>{editing === "bank" ? <EditForm fields={bankFieldValues} onSave={saveBank} onCancel={() => setEditing(null)} /> : <FieldGrid fields={bankFieldValues} />}</Panel>;
  else if (active === "preferences") content = <Panel title="Investment Preferences" description="Manage your investment objectives and risk preference." action={editing !== "preferences" ? <EditButton onClick={() => setEditing("preferences")} /> : undefined}>{editing === "preferences" ? <EditForm fields={preferenceFieldValues} onSave={savePreferences} onCancel={() => setEditing(null)} /> : <FieldGrid fields={preferenceFieldValues} />}</Panel>;
  else if (active === "documents") content = <DocumentsContent />;
  else content = <SecurityContent type={active === "pin" ? "PIN" : "Password"} onNotice={setNotice} />;

  return <main className="min-w-0"><div className="mb-5"><h1 className="font-display text-3xl font-extrabold tracking-[-0.045em] text-star-900 sm:text-[2.15rem]">Profile</h1><p className="mt-1.5 text-sm leading-6 text-star-muted sm:text-base">View and manage your personal information and keep your details up to date.</p></div>{notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#cce7d0] bg-[#eff8f0] px-4 py-3 text-sm font-semibold text-star-700"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="rounded px-1 hover:bg-white" aria-label="Dismiss message">×</button></div>}<div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]"><aside className="min-w-0 space-y-6"><ProfileIdentity personal={personal} onPhoto={(file) => setNotice(file ? `${file.name} was selected locally. No photo is uploaded in this preview.` : "")} /><AccountNavigation active={active} onSelect={(section) => { setActive(section); setEditing(null); }} /></aside><div className="min-w-0">{content}</div></div></main>;
}
