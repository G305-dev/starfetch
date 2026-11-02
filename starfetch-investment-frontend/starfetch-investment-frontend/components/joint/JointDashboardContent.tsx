"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, BriefcaseBusiness, CircleDollarSign, FileText, Landmark, ShieldCheck, TrendingUp, UserRound } from "lucide-react";
import {
  accountVerification,
  investments,
  jointAccount,
  jointAccountHolders,
  performanceSummary,
  portfolioPerformance,
  portfolioSummary,
  recentTransactions,
  signingMandate,
  type JointPerformanceFilter,
} from "./joint-dashboard-data";

const filters: JointPerformanceFilter[] = ["1M", "3M", "6M", "YTD", "1Y", "All"];
const summaryIcons = { "portfolio-value": Landmark, "total-invested": BriefcaseBusiness, "returns-ytd": TrendingUp, "active-investments": BarChart3 };
const verificationStatusClasses: Record<(typeof accountVerification.supportedStatuses)[number], string> = {
  "Profile Incomplete": "bg-[#fff3d9] text-[#9a6200]",
  "Verification Pending": "bg-[#e4f1fb] text-[#1671b6]",
  "Action Required": "bg-[#fde8e8] text-[#b42318]",
  Verified: "bg-[#e1f7e7] text-[#16743d]",
};

function SummaryCards() {
  return <section aria-label="Joint account portfolio summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{portfolioSummary.map((card) => { const Icon = summaryIcons[card.id]; return <article key={card.id} className={`rounded-xl border p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] ${card.id === "portfolio-value" ? "border-[#d9eac8] bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-star-muted">{card.label}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-star-900">{card.value}</p><p className={`mt-3 text-xs font-bold ${card.tone === "positive" ? "text-[#168348]" : "text-star-muted"}`}>{card.detail}</p></div><span className="grid size-11 place-items-center rounded-full bg-white/80 text-star-700"><Icon size={22} aria-hidden="true" /></span></div></article>; })}</section>;
}

function PortfolioPerformance() {
  const [activeFilter, setActiveFilter] = useState<JointPerformanceFilter>("YTD");
  const data = portfolioPerformance[activeFilter];
  const chart = useMemo(() => {
    const width = 720;
    const height = 274;
    const padding = { left: 54, right: 24, top: 24, bottom: 42 };
    const min = Math.floor((Math.min(...data.map((point) => point.value)) - 1) / 2) * 2;
    const max = Math.ceil((Math.max(...data.map((point) => point.value)) + 1) / 2) * 2;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const points = data.map((point, index) => ({
      ...point,
      x: padding.left + (innerWidth / Math.max(data.length - 1, 1)) * index,
      y: padding.top + ((max - point.value) / Math.max(max - min, 1)) * innerHeight,
    }));
    const line = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
    const area = `${line} L${points.at(-1)?.x ?? padding.left} ${height - padding.bottom} L${points[0]?.x ?? padding.left} ${height - padding.bottom} Z`;
    return { width, height, padding, min, max, points, line, area };
  }, [data]);
  const ticks = [chart.min, chart.min + (chart.max - chart.min) / 2, chart.max];
  const lastPoint = chart.points.at(-1);

  return <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6" aria-labelledby="joint-performance-heading"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h2 id="joint-performance-heading" className="text-xl font-extrabold text-star-900">Portfolio Performance</h2><p className="mt-1 text-sm text-star-muted">Track the growth of your joint investment portfolio.</p></div><div className="flex flex-wrap gap-1.5" aria-label="Portfolio performance period">{filters.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} aria-pressed={activeFilter === filter} className={`min-h-8 rounded-md px-3 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 ${activeFilter === filter ? "bg-star-700 text-white" : "bg-star-50 text-star-700 hover:bg-star-100"}`}>{filter}</button>)}</div></div><div className="mt-5 overflow-x-auto"><svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`${activeFilter} portfolio performance reaching fifty-two point four eight million naira`} className="min-w-[560px] w-full"><defs><linearGradient id="joint-performance-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#83c99b" stopOpacity=".58" /><stop offset="1" stopColor="#edf6de" stopOpacity=".08" /></linearGradient></defs>{ticks.map((value) => { const y = chart.padding.top + ((chart.max - value) / Math.max(chart.max - chart.min, 1)) * (chart.height - chart.padding.top - chart.padding.bottom); return <g key={value}><line x1={chart.padding.left} x2={chart.width - chart.padding.right} y1={y} y2={y} stroke="#dcebd5" /><text x="4" y={y + 4} fontSize="10" fill="#607668">₦{value.toFixed(0)}M</text></g>; })}<path d={chart.area} fill="url(#joint-performance-area)" /><path d={chart.line} fill="none" stroke="#097859" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{chart.points.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="4" fill="#097859" stroke="white" strokeWidth="2" /><text x={point.x} y={chart.height - 15} textAnchor="middle" fontSize="10" fill="#607668">{point.label}</text></g>)}{lastPoint ? <g><rect x={Math.max(lastPoint.x - 52, chart.padding.left)} y={Math.max(lastPoint.y - 45, 5)} width="104" height="29" rx="6" fill="#003B2A" /><text x={Math.max(lastPoint.x, chart.padding.left + 52)} y={Math.max(lastPoint.y - 26, 23)} textAnchor="middle" fontSize="11" fontWeight="700" fill="white">₦{lastPoint.value.toFixed(2)}M</text></g> : null}</svg></div><div className="mt-5 grid gap-3 border-t border-star-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">{performanceSummary.map((metric) => <div key={metric.label}><p className="text-xs font-semibold text-star-muted">{metric.label}</p><p className={`mt-1 text-lg font-extrabold ${metric.positive ? "text-[#168348]" : "text-star-900"}`}>{metric.value}</p></div>)}</div></section>;
}

function JointAccountOverview() {
  return <aside id="joint-profile" className="scroll-mt-24 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="joint-overview-heading"><h2 id="joint-overview-heading" className="text-xl font-extrabold text-star-900">Joint Account Overview</h2><p className="mt-1 text-sm text-star-muted">Account holders and joint account instructions.</p><div className="mt-5 border-y border-star-100 py-4"><h3 className="text-xs font-extrabold uppercase tracking-[0.1em] text-star-700">Account Holders</h3><div className="mt-4 space-y-4">{jointAccountHolders.map((holder) => <div key={holder.id} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-star-900 text-xs font-extrabold text-white">{holder.initials}</span><div><p className="text-sm font-extrabold text-star-900">{holder.name}</p><p className="mt-0.5 text-xs text-star-muted">{holder.role}</p></div></div>)}</div></div><div className="mt-5"><h3 className="text-xs font-extrabold uppercase tracking-[0.1em] text-star-700">Account Mandate / Signing Rule</h3><div className="mt-3 rounded-lg border border-[#cce7d0] bg-[#eff8f0] p-4"><p className="text-sm font-extrabold text-star-900">{signingMandate.selected}</p><p className="mt-2 text-xs leading-5 text-star-muted">{signingMandate.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{signingMandate.supportedRules.map((rule) => <span key={rule} className={`rounded-full px-2.5 py-1 text-[0.65rem] font-extrabold ${rule === signingMandate.selected ? "bg-star-700 text-white" : "border border-[#bdddc3] bg-white text-star-700"}`}>{rule.replace(" Holder to Sign", "")}</span>)}</div></div></div><div className="mt-5 border-t border-star-100 pt-5"><h3 className="text-xs font-extrabold uppercase tracking-[0.1em] text-star-700">Account Verification</h3><div className="mt-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#e1f7e7] text-[#16743d]"><ShieldCheck size={21} aria-hidden="true" /></span><span><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${verificationStatusClasses[accountVerification.status]}`}>{accountVerification.status}</span><span className="mt-1 block text-xs text-star-muted">Joint account verification is complete.</span></span></div></div></aside>;
}

function InvestmentsTable() {
  return <section id="investments" className="scroll-mt-24 rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="joint-investments-heading"><div className="flex flex-col gap-3 border-b border-star-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="joint-investments-heading" className="text-xl font-extrabold text-star-900">My Investments</h2><p className="mt-1 text-sm text-star-muted">Your active joint-account investment products.</p></div><a href="/joint/investments" className="inline-flex items-center gap-1 text-sm font-extrabold text-star-700 no-underline hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">View All Investments <ArrowRight size={16} aria-hidden="true" /></a></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-[#f7f9f8] text-xs font-extrabold text-star-700"><tr>{["Investment Product", "Amount Invested", "Current Value", "Returns", "Status"].map((label) => <th key={label} className="px-5 py-3.5">{label}</th>)}</tr></thead><tbody className="divide-y divide-star-100">{investments.map((investment) => <tr key={investment.id} className="text-sm"><td className="px-5 py-4"><span className="font-extrabold text-star-900">{investment.product}</span></td><td className="px-5 py-4 font-semibold text-star-900">{investment.amountInvested}</td><td className="px-5 py-4 font-semibold text-star-900">{investment.currentValue}</td><td className="px-5 py-4 font-extrabold text-[#168348]">{investment.returns}</td><td className="px-5 py-4"><span className="inline-flex rounded-full bg-[#e1f7e7] px-2.5 py-1 text-xs font-extrabold text-[#16743d]">{investment.status}</span></td></tr>)}</tbody></table></div></section>;
}

function RecentTransactions() {
  return <section id="transactions" className="scroll-mt-24 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="joint-transactions-heading"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="joint-transactions-heading" className="text-xl font-extrabold text-star-900">Recent Transactions</h2><p className="mt-1 text-sm text-star-muted">The latest activity on this joint account.</p></div><a href="/joint/transactions" className="inline-flex items-center gap-1 text-sm font-extrabold text-star-700 no-underline hover:text-star-limeDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">View All Transactions <ArrowRight size={16} aria-hidden="true" /></a></div><div className="mt-5 divide-y divide-star-100">{recentTransactions.map((transaction) => <article key={transaction.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"><span className={`grid size-10 place-items-center rounded-full ${transaction.title === "Returns Received" ? "bg-[#e1f7e7] text-[#16743d]" : transaction.title === "Document Uploaded" ? "bg-[#e4f1fb] text-[#1671b6]" : "bg-star-50 text-star-700"}`}>{transaction.title === "Document Uploaded" ? <FileText size={19} aria-hidden="true" /> : transaction.title === "Returns Received" ? <CircleDollarSign size={19} aria-hidden="true" /> : <UserRound size={19} aria-hidden="true" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-star-900">{transaction.title}</p><p className="mt-1 text-xs text-star-muted">{transaction.detail} <span aria-hidden="true">·</span> {transaction.date}</p></div><strong className={transaction.type === "status" ? "rounded-full bg-[#e1f7e7] px-2.5 py-1 text-xs text-[#16743d]" : "text-sm text-star-900"}>{transaction.amount}</strong></article>)}</div></section>;
}

export function JointDashboardContent() {
  const greeting = `${jointAccountHolders[0].firstName} & ${jointAccountHolders[1].firstName}`;
  return <main><section><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account overview</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Good morning, {greeting}</h1><p className="mt-2 text-sm leading-6 text-star-muted sm:text-base">{jointAccount.accountLabel}</p></section><div className="mt-7"><SummaryCards /></div><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_360px]"><PortfolioPerformance /><JointAccountOverview /></div><div className="mt-5"><InvestmentsTable /></div><div className="mt-5"><RecentTransactions /></div></main>;
}
