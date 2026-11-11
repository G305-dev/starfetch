import { AlertTriangle, Building2, CheckCircle2, CircleAlert, Clock3, FileUp, ShieldCheck, UserRound } from "lucide-react";
import {
  getCorporateApplicationDisplay,
  type CorporateApplicationHistory,
  type CorporateOnboardingRecord,
  type CorporateSnapshotFreshness,
} from "@/lib/corporate/application";

type TierTone = "neutral" | "pending" | "warning" | "positive" | "negative";

type TierStatus = { label: string; tone: TierTone; detail: string };

const toneClassNames: Record<TierTone, string> = {
  neutral: "bg-star-100 text-star-700",
  pending: "bg-[#fff4d8] text-[#976800]",
  warning: "bg-[#fff1e5] text-[#a95600]",
  positive: "bg-[#e1f7e7] text-[#16743d]",
  negative: "bg-red-50 text-red-700",
};

const unavailableTierStatus: TierStatus = {
  label: "Unavailable",
  tone: "neutral",
  detail: "This outcome is not exposed by the approved Corporate O2/O3/O11 APIs.",
};

function StatusPill({ label, tone }: { label: string; tone: TierTone }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${toneClassNames[tone]}`}>
    {tone === "positive" ? <CheckCircle2 size={13} aria-hidden="true" /> : tone === "negative" ? <CircleAlert size={13} aria-hidden="true" /> : tone === "pending" ? <Clock3 size={13} aria-hidden="true" /> : tone === "warning" ? <AlertTriangle size={13} aria-hidden="true" /> : <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
    {label}
  </span>;
}

function TierCard({ number, title, description, icon: Icon, status, children }: { number: string; title: string; description: string; icon: typeof Building2; status: TierStatus; children: React.ReactNode }) {
  return <article className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-star-100 text-star-700"><Icon size={20} aria-hidden="true" /></span><div><p className="text-[0.62rem] font-extrabold uppercase tracking-[0.15em] text-star-700">Tier {number}</p><h3 className="mt-1 text-base font-extrabold text-star-900">{title}</h3></div></div><StatusPill label={status.label} tone={status.tone} /></div><p className="mt-4 text-sm leading-6 text-star-muted">{description}</p><div className="mt-4 border-t border-star-100 pt-4">{children}</div></article>;
}

function Lifecycle({ onboarding }: { onboarding: CorporateOnboardingRecord | null }) {
  const lifecycle = onboarding ? getCorporateApplicationDisplay(onboarding.status) : null;
  return <section className="mt-5 rounded-xl border border-star-200 bg-star-50 px-4 py-3" aria-label="Corporate application lifecycle"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Application lifecycle</p><p className="mt-1 text-sm font-extrabold text-star-900">{lifecycle?.label ?? "Unavailable"}</p></div>{lifecycle ? <StatusPill label={lifecycle.label} tone={lifecycle.tone} /> : null}</div><p className="mt-2 text-xs leading-5 text-star-muted">{lifecycle?.detail ?? "No owner-scoped Corporate O3 record is currently loaded."}</p></section>;
}

function OnboardingDetails({ onboarding }: { onboarding: CorporateOnboardingRecord }) {
  const details = onboarding.details;
  const rows: Array<[string, string]> = [
    ["Institution name", details.institutionName],
    ["Date of incorporation", details.dateOfIncorporation],
    ["RC number", details.rcNumber],
    ["Business phone number", details.businessPhoneNumber],
    ["Business email", details.businessEmail],
    ["Tax Identification Number", details.taxIdentificationNumberMasked ?? "Not available while the approved privacy/KMS gate is closed"],
  ];
  return <section className="mt-5 rounded-xl border border-star-200 bg-white" aria-labelledby="corporate-o3-details-heading"><div className="border-b border-star-100 px-5 py-4"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Owner-scoped O3 read</p><h3 id="corporate-o3-details-heading" className="mt-1 text-base font-extrabold text-star-900">Corporate application details</h3><p className="mt-1 text-xs leading-5 text-star-muted">These fields were returned by the approved backend read. The TIN is backend-masked or unavailable; plaintext TIN is never rendered.</p></div><dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-star-700">{value}</dd></div>)}</dl></section>;
}

function History({ history }: { history: CorporateApplicationHistory | null }) {
  if (!history) return null;
  return <section className="mt-5 rounded-xl border border-star-200 bg-white" aria-labelledby="corporate-o11-history-heading"><div className="border-b border-star-100 px-5 py-4"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Owner-scoped O11 read</p><h3 id="corporate-o11-history-heading" className="mt-1 text-base font-extrabold text-star-900">Application history</h3></div>{history.history.length ? <ol className="divide-y divide-star-100">{history.history.map((item) => <li key={item.id} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold text-star-900">{item.event.replace(/_/g, " ")}</p><p className="mt-0.5 text-xs text-star-muted">{item.fromStatus ?? "No previous status"} → {item.toStatus}</p></div><time className="text-xs text-star-muted" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time></li>)}</ol> : <p className="px-5 py-4 text-sm text-star-muted">No permitted lifecycle events were returned.</p>}<div className="border-t border-star-100 px-5 py-4"><h4 className="text-sm font-extrabold text-star-900">Detail amendments</h4><p className="mt-1 text-xs leading-5 text-star-muted">Safe metadata only. Previous values, TIN/envelope data and actor information are not exposed.</p>{history.detailsAmendments.length ? <ol className="mt-3 space-y-2">{history.detailsAmendments.map((amendment) => <li key={`${amendment.version}-${amendment.changedAt}`} className="rounded-lg bg-star-50 px-3 py-2 text-xs leading-5 text-star-muted"><span className="font-extrabold text-star-900">Version {amendment.version}</span> — {amendment.changedFieldNames.join(", ")}<time className="ml-2 text-star-muted" dateTime={amendment.changedAt}>({new Date(amendment.changedAt).toLocaleString()})</time></li>)}</ol> : <p className="mt-3 text-xs text-star-muted">No safe amendment metadata was returned.</p>}</div></section>;
}

const snapshotIssueLabels: Record<string, string> = {
  SNAPSHOT_MISSING: "No staged snapshot exists",
  ACCOUNT_KIND_CHANGED: "Account context changed",
  CORPORATE_DETAILS_VERSION_CHANGED: "Corporate details version changed",
  JOINT_MEMBERSHIP_VERSION_CHANGED: "Joint membership context changed",
};

function SnapshotFreshness({ freshness }: { freshness: CorporateSnapshotFreshness | null }) {
  if (!freshness) return null;
  const label = freshness.isFresh ? "Source context current" : "Source context stale";
  return <section className="mt-5 rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="corporate-snapshot-freshness-heading"><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Read-only snapshot staging</p><div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 id="corporate-snapshot-freshness-heading" className="text-base font-extrabold text-star-900">Verification snapshot freshness</h3><StatusPill label={label} tone={freshness.isFresh ? "positive" : "warning"} /></div><p className="mt-2 text-xs leading-5 text-star-muted">This is a technical source-freshness signal for the latest immutable staged snapshot. It is not Mono verification, document completion, submission permission, compliance approval or investment eligibility.</p><dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2"><div><dt className="font-bold uppercase tracking-[0.06em] text-star-muted">Generation</dt><dd className="mt-1 font-extrabold text-star-900">{freshness.generation ?? "No snapshot"}</dd></div><div><dt className="font-bold uppercase tracking-[0.06em] text-star-muted">Snapshot</dt><dd className="mt-1 font-extrabold text-star-900">{freshness.snapshotId ? "Staged snapshot present" : "No snapshot"}</dd></div></dl>{freshness.issues.length ? <ul className="mt-4 space-y-1 text-xs leading-5 text-star-muted">{freshness.issues.map((issue) => <li key={issue}>• {snapshotIssueLabels[issue] ?? issue}</li>)}</ul> : <p className="mt-4 text-xs text-star-muted">No safe freshness issues were returned.</p>}<p className="mt-4 text-xs leading-5 text-star-muted">Snapshot regeneration is not offered here because its approved ruleset-binding prerequisites are not available to this frontend.</p></section>;
}

export function CorporateVerificationProgress({ onboarding = null, history = null, snapshotFreshness = null, loading = false, readError = null, onRetryRead }: { onboarding?: CorporateOnboardingRecord | null; history?: CorporateApplicationHistory | null; snapshotFreshness?: CorporateSnapshotFreshness | null; loading?: boolean; readError?: string | null; onRetryRead?: () => void }) {
  return <section id="verification" className="scroll-mt-24" aria-labelledby="corporate-verification-progress-heading"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-star-700">Corporate verification</p><h2 id="corporate-verification-progress-heading" className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-star-900">Three-stage verification progress</h2></div><p className="max-w-md text-xs leading-5 text-star-muted">Lifecycle, verification evidence, document completeness and staff/compliance decisions remain separate backend-backed records.</p></div><Lifecycle onboarding={onboarding} /><div className="mt-5 grid gap-4 xl:grid-cols-3"><TierCard number="1" title="Basic information & Mono verification" description="Mono is not connected from this browser. An application lifecycle status does not prove verification evidence." icon={Building2} status={unavailableTierStatus}><p className="text-xs leading-5 text-star-muted">{unavailableTierStatus.detail}</p></TierCard><TierCard number="2" title="Document uploads" description="Document rules, completeness and secure upload require separately approved APIs." icon={FileUp} status={unavailableTierStatus}><p className="text-xs leading-5 text-star-muted">{unavailableTierStatus.detail} No document category or completion outcome is assumed.</p><button type="button" disabled className="mt-4 inline-flex min-h-10 w-full cursor-not-allowed items-center justify-center gap-2 rounded-md border border-star-200 bg-star-50 px-3 text-sm font-extrabold text-star-muted opacity-80"><FileUp size={16} aria-hidden="true" />Secure upload unavailable</button></TierCard><TierCard number="3" title="Staff review & compliance decision" description="Starfetch staff manage review and compliance decisions separately. Corporate investors cannot approve their own applications." icon={ShieldCheck} status={unavailableTierStatus}><p className="text-xs leading-5 text-star-muted">{unavailableTierStatus.detail} Lifecycle status does not substitute for a staff/compliance decision.</p></TierCard></div>{loading ? <p className="mt-4 flex items-center gap-2 rounded-lg border border-star-200 bg-star-50 px-4 py-3 text-xs leading-5 text-star-muted"><Clock3 size={15} className="text-star-700" aria-hidden="true" />Loading owner-scoped application details and permitted history…</p> : null}{readError ? <div className="mt-4 rounded-lg border border-[#f2d89d] bg-[#fff9e8] px-4 py-3 text-xs leading-5 text-star-muted"><UserRound size={15} className="mr-2 inline text-star-700" aria-hidden="true" />{readError}{onRetryRead ? <button type="button" onClick={onRetryRead} className="ml-3 font-extrabold text-star-700 underline decoration-star-lime decoration-2 underline-offset-2">Retry read</button> : null}</div> : null}{onboarding ? <OnboardingDetails onboarding={onboarding} /> : null}<History history={history} /><SnapshotFreshness freshness={snapshotFreshness} /></section>;
}
