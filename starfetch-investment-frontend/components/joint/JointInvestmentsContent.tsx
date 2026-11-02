"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, BriefcaseBusiness, CircleDollarSign, Eye, FileText, Landmark, MoreHorizontal, Plus, TrendingUp, X } from "lucide-react";
import {
  jointInvestmentFilterTabs,
  jointInvestmentPageCopy,
  jointInvestmentSummary,
  jointInvestments,
  type JointInvestment,
  type JointInvestmentFilter,
  type JointInvestmentStatus,
} from "./joint-investments-data";

const summaryIcons = {
  "total-invested": Landmark,
  "current-value": CircleDollarSign,
  "returns-ytd": TrendingUp,
  "active-investments": BarChart3,
};

const productIcons: Record<JointInvestment["id"], typeof BriefcaseBusiness> = {
  "fixed-note": Landmark,
  "discretionary-portfolio": BarChart3,
  "execution-mandate": BriefcaseBusiness,
};

const statusClasses: Record<JointInvestmentStatus, string> = {
  Active: "bg-[#e1f7e7] text-[#16743d]",
  Matured: "bg-[#e4f1fb] text-[#1671b6]",
  Pending: "bg-[#fff3d9] text-[#9a6200]",
  Closed: "bg-star-100 text-star-700",
};

function InvestmentSummaryIconBar() {
  return <section aria-label="Investment summary shortcuts" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
    {jointInvestmentSummary.map((item) => {
      const Icon = summaryIcons[item.id];
      return <div key={item.id} title={item.label} aria-label={`${item.label}: ${item.value}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-star-200 bg-white px-3 text-star-700 shadow-[0_2px_10px_rgba(14,62,46,0.035)]">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-star-50"><Icon size={16} aria-hidden="true" /></span>
        <span className="hidden text-xs font-extrabold text-star-900 min-[440px]:block">{item.label}</span>
      </div>;
    })}
  </section>;
}

function SummaryCards() {
  return <section aria-label="Joint investment summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{jointInvestmentSummary.map((item) => <article key={item.id} className={`rounded-xl border p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] ${item.id === "current-value" ? "border-[#d9eac8] bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}><p className="text-sm font-semibold text-star-muted">{item.label}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-star-900">{item.value}</p><p className={`mt-3 text-xs font-bold ${item.tone === "positive" ? "text-[#168348]" : "text-star-muted"}`}>{item.detail}</p></article>)}</section>;
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" }) {
  return <div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-star-muted">{label}</p><p className={`mt-1 text-sm font-extrabold ${tone === "positive" ? "text-[#168348]" : "text-star-900"}`}>{value}</p></div>;
}

function InvestmentActions({ investment, onViewDetails, onStatement }: { investment: JointInvestment; onViewDetails: (investment: JointInvestment) => void; onStatement: (investment: JointInvestment) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="relative flex w-full items-center justify-end sm:w-auto"><button type="button" onClick={() => setOpen((value) => !value)} aria-label={`More actions for ${investment.productName}`} aria-expanded={open} className="grid size-10 shrink-0 place-items-center rounded-md border border-star-200 text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><MoreHorizontal size={20} aria-hidden="true" /></button>{open ? <div className="absolute right-0 top-12 z-20 w-44 rounded-lg border border-star-200 bg-white p-1.5 shadow-card"><button type="button" onClick={() => { setOpen(false); onViewDetails(investment); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-star-900 transition hover:bg-star-50"><Eye size={16} className="text-star-700" aria-hidden="true" />View Details</button><button type="button" onClick={() => { setOpen(false); onStatement(investment); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-star-900 transition hover:bg-star-50"><FileText size={16} className="text-star-700" aria-hidden="true" />View Statement</button></div> : null}</div>;
}

function InvestmentRow({ investment, onViewDetails, onStatement }: { investment: JointInvestment; onViewDetails: (investment: JointInvestment) => void; onStatement: (investment: JointInvestment) => void }) {
  const ProductIcon = productIcons[investment.id];
  return <article className="rounded-lg border border-star-200 bg-white p-4 transition hover:border-star-300 hover:shadow-[0_5px_16px_rgba(14,62,46,0.06)] sm:p-5"><div className="grid gap-5 xl:grid-cols-[minmax(190px,1.35fr)_minmax(105px,.72fr)_minmax(105px,.75fr)_minmax(85px,.55fr)_minmax(105px,.68fr)_minmax(104px,.72fr)_minmax(126px,.82fr)] xl:items-center"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-star-50 text-star-700"><ProductIcon size={20} aria-hidden="true" /></span><div className="min-w-0"><h3 className="text-base font-extrabold text-star-900">{investment.productName}</h3><p className="mt-1 text-sm leading-5 text-star-muted">{investment.description}</p></div></div><div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4 xl:contents"><Metric label="Amount Invested" value={investment.amountInvested} /><Metric label="Current Value" value={investment.currentValue} /><Metric label="Return" value={investment.returnPercentage} tone="positive" /><Metric label="Maturity Date" value={investment.maturityDate} /></div><div className="flex flex-wrap items-center justify-between gap-3 xl:contents"><div><p className="text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-star-muted xl:hidden">Status</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClasses[investment.status]}`}>{investment.status}</span></div><InvestmentActions investment={investment} onViewDetails={onViewDetails} onStatement={onStatement} /></div></div></article>;
}

function InvestmentDetailModal({ investment, onClose }: { investment: JointInvestment; onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="joint-investment-detail-title"><button type="button" onClick={onClose} aria-label="Close investment details" className="absolute inset-0 bg-star-900/55" /><section className="relative z-10 w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-star-700">Investment details</p><h2 id="joint-investment-detail-title" className="mt-2 text-xl font-extrabold text-star-900">{investment.productName}</h2><p className="mt-1 text-sm text-star-muted">{investment.description}</p></div><button type="button" onClick={onClose} aria-label="Close investment details" className="grid size-10 shrink-0 place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><X size={20} aria-hidden="true" /></button></div><div className="mt-6 grid gap-4 border-y border-star-100 py-5 sm:grid-cols-2"><Metric label="Amount Invested" value={investment.amountInvested} /><Metric label="Current Value" value={investment.currentValue} /><Metric label="Return" value={investment.returnPercentage} tone="positive" /><Metric label="Maturity Date" value={investment.maturityDate} /></div><div className="mt-5 flex items-center justify-between gap-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${statusClasses[investment.status]}`}>{investment.status}</span><button type="button" onClick={onClose} className="rounded-md bg-star-700 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Close</button></div></section></div>;
}

function EmptyInvestmentsState() {
  return <div className="grid min-h-72 place-items-center rounded-lg border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><BriefcaseBusiness size={23} aria-hidden="true" /></span><h3 className="mt-4 text-lg font-extrabold text-star-900">{jointInvestmentPageCopy.emptyTitle}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-star-muted">{jointInvestmentPageCopy.emptyDescription}</p><a href="/joint/products" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Explore Investments</a></div></div>;
}

export function JointInvestmentsContent() {
  const [activeFilter, setActiveFilter] = useState<JointInvestmentFilter>("active");
  const [selectedInvestment, setSelectedInvestment] = useState<JointInvestment | null>(null);
  const [notice, setNotice] = useState("");
  const visibleInvestments = useMemo(() => {
    if (activeFilter === "all") return jointInvestments;
    const status = activeFilter === "active" ? "Active" : "Matured";
    return jointInvestments.filter((investment) => investment.status === status);
  }, [activeFilter]);
  const showStatementNotice = (investment: JointInvestment) => setNotice(`${investment.productName} statement preview is a frontend-only placeholder.`);

  return <main><section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account investments</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">{jointInvestmentPageCopy.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">{jointInvestmentPageCopy.description}</p></div><div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end"><InvestmentSummaryIconBar /><a href="/joint/products" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><Plus size={18} aria-hidden="true" />Invest Now</a></div></section><div className="mt-7"><SummaryCards /></div><section className="mt-5 rounded-xl border border-star-200 bg-white p-4 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6" aria-labelledby="your-investments-heading"><div className="flex flex-col gap-5 border-b border-star-100 pb-5 lg:flex-row lg:items-end lg:justify-between"><div><h2 id="your-investments-heading" className="text-xl font-extrabold text-star-900">{jointInvestmentPageCopy.listTitle}</h2><p className="mt-1 text-sm leading-6 text-star-muted">{jointInvestmentPageCopy.listDescription}</p></div><div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Investment status filters">{jointInvestmentFilterTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeFilter === tab.id} onClick={() => setActiveFilter(tab.id)} className={`min-h-9 rounded-md px-3.5 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${activeFilter === tab.id ? "bg-star-700 text-white" : "bg-star-50 text-star-700 hover:bg-star-100"}`}>{tab.label} <span className={`ml-1 ${activeFilter === tab.id ? "text-white/75" : "text-star-muted"}`}>({tab.count})</span></button>)}</div></div><div className="mt-5 space-y-3" role="tabpanel">{visibleInvestments.length ? visibleInvestments.map((investment) => <InvestmentRow key={investment.id} investment={investment} onViewDetails={setSelectedInvestment} onStatement={showStatementNotice} />) : <EmptyInvestmentsState />}</div></section><section id="explore-opportunities" className="mt-5 scroll-mt-24 overflow-hidden rounded-xl border border-[#cce7d0] bg-[linear-gradient(115deg,#eff8e8_0%,#e2f3d7_100%)] p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-xl font-extrabold text-star-900">{jointInvestmentPageCopy.exploreTitle}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted">{jointInvestmentPageCopy.exploreDescription}</p></div><a href="/joint/products" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-star-700 px-5 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2">Invest Now <ArrowRight size={17} aria-hidden="true" /></a></div></section>{selectedInvestment ? <InvestmentDetailModal investment={selectedInvestment} onClose={() => setSelectedInvestment(null)} /> : null}{notice ? <div role="status" className="fixed bottom-5 right-5 z-[90] max-w-sm rounded-lg bg-star-900 px-4 py-3 text-sm font-semibold text-white shadow-card"><div className="flex items-start gap-3"><span className="min-w-0">{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message" className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded text-white/80 hover:bg-white/10 hover:text-white"><X size={16} aria-hidden="true" /></button></div></div> : null}</main>;
}
