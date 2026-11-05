"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, CircleAlert, CircleDollarSign, LoaderCircle, ReceiptText, RefreshCw, UsersRound, WalletCards } from "lucide-react";
import { getJointPortfolio, getJointTransactions, type InvestorPortfolio, type InvestorTransactionsPage, type JointAccountSummary } from "@/lib/api/client";
import { InvestmentHoldings } from "@/components/portal/InvestmentHoldings";
import { formatCurrencyMinor, formatDashboardDate } from "@/components/portal/dashboard-formatters";
import { useJointAccounts } from "./JointAccountProvider";

type RequestState = "loading" | "ready" | "error";

function LoadingPanel({ label = "Loading your Joint Account…" }: { label?: string }) {
  return <section className="grid min-h-[260px] place-items-center rounded-xl border border-star-200 bg-white px-5 text-center"><div><LoaderCircle size={28} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">{label}</p></div></section>;
}

function RetryPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <section className="grid min-h-[240px] place-items-center rounded-xl border border-red-200 bg-white px-5 text-center"><div className="max-w-md"><CircleAlert size={28} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">{title}</h2><p className="mt-2 text-sm leading-6 text-star-muted">{message}</p><button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section>;
}

function EmptyAccountState() {
  return <section className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div className="max-w-lg"><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><UsersRound size={23} aria-hidden="true" /></span><h1 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.035em] text-star-900">No Joint Accounts yet</h1><p className="mt-2 text-sm leading-6 text-star-muted">Open a Joint Account as the first holder, or check your notifications for an invitation.</p><Link href="/register/joint" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Open a Joint Account</Link></div></section>;
}

function AccountSwitcher() {
  const { accounts, selectedAccountId, selectAccount } = useJointAccounts();
  if (accounts.length < 2) return null;
  return <label className="mt-5 block max-w-xl"><span className="text-sm font-extrabold text-star-900">Choose Joint Account</span><select value={selectedAccountId ?? ""} onChange={(event) => selectAccount(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm font-extrabold text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100">{accounts.map((account) => <option key={account.jointAccountId} value={account.jointAccountId}>{account.displayName}{account.awaitingSecondHolder ? " — second holder pending" : ""}</option>)}</select></label>;
}

function PortfolioSummary({ portfolio }: { portfolio: InvestorPortfolio }) {
  const cards = [
    { label: "Portfolio value", value: formatCurrencyMinor(portfolio.totalValueMinor, portfolio.currency), detail: portfolio.totalValueMinor === null ? "Not available" : "Current portfolio value", icon: WalletCards, emphasis: true },
    { label: "Holdings", value: portfolio.holdingCount === null ? "Not available" : String(portfolio.holdingCount), detail: portfolio.holdingCount === null ? "Not available" : "Investment holdings", icon: BarChart3, emphasis: false },
    { label: "Total return", value: portfolio.totalReturnMinor === null ? "Not available" : formatCurrencyMinor(portfolio.totalReturnMinor, portfolio.currency), detail: portfolio.totalReturnMinor === null ? "Not available" : "Total return", icon: CircleDollarSign, emphasis: false },
  ];
  return <section className="grid gap-4 lg:grid-cols-3" aria-label="Joint portfolio summary">{cards.map(({ label, value, detail, icon: Icon, emphasis }) => <article key={label} className={`rounded-xl border p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] ${emphasis ? "border-[#d9eac8] bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/80 text-star-700"><Icon size={23} aria-hidden="true" /></span><div><p className="text-sm font-semibold text-star-muted">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-star-900">{value}</p><p className="mt-2 text-xs font-semibold text-star-muted">{detail}</p></div></div></article>)}</section>;
}

function RecentTransactions({ page }: { page: InvestorTransactionsPage }) {
  if (page.transactions.length === 0) return <section className="rounded-xl border border-dashed border-star-300 bg-star-50 px-5 py-9 text-center"><ReceiptText size={22} className="mx-auto text-star-700" aria-hidden="true" /><h2 className="mt-3 text-lg font-extrabold text-star-900">No transactions yet</h2><p className="mt-2 text-sm leading-6 text-star-muted">Your Joint Account activity will appear here when available.</p></section>;
  return <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-extrabold text-star-900">Recent transactions</h2><p className="mt-1 text-sm text-star-muted">Latest activity for this Joint Account.</p></div><Link href="/joint/transactions" className="text-sm font-extrabold text-star-700 no-underline hover:text-star-900">View all</Link></div><div className="mt-5 divide-y divide-star-100">{page.transactions.map((transaction, index) => <article key={transaction.id ?? `transaction-${index}`} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"><span className="grid size-10 place-items-center rounded-full bg-star-50 text-star-700"><ReceiptText size={18} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="font-extrabold text-star-900">{transaction.description ?? transaction.type ?? "Transaction"}</p><p className="mt-1 text-xs text-star-muted">{transaction.type ?? "Details not available"} <span aria-hidden="true">·</span> {formatDashboardDate(transaction.occurredAt)}</p></div><div className="text-right"><p className="font-extrabold tabular-nums text-star-900">{formatCurrencyMinor(transaction.amountMinor, transaction.currency)}</p><span className="mt-1 inline-flex rounded-full bg-star-100 px-2 py-0.5 text-xs font-bold text-star-700">{transaction.status ?? "Not available"}</span></div></article>)}</div></section>;
}

function FinancialSnapshot({ jointAccountId }: { jointAccountId: string }) {
  const [portfolio, setPortfolio] = useState<InvestorPortfolio | null>(null);
  const [transactions, setTransactions] = useState<InvestorTransactionsPage | null>(null);
  const [portfolioState, setPortfolioState] = useState<RequestState>("loading");
  const [transactionsState, setTransactionsState] = useState<RequestState>("loading");
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setPortfolio(null);
    setTransactions(null);
    setPortfolioState("loading");
    setTransactionsState("loading");
    const [portfolioResult, transactionResult] = await Promise.allSettled([getJointPortfolio(jointAccountId), getJointTransactions(jointAccountId, 1, 5)]);
    if (version !== requestVersion.current) return;
    if (portfolioResult.status === "fulfilled") { setPortfolio(portfolioResult.value); setPortfolioState("ready"); } else setPortfolioState("error");
    if (transactionResult.status === "fulfilled") { setTransactions(transactionResult.value); setTransactionsState("ready"); } else setTransactionsState("error");
  }, [jointAccountId]);

  useEffect(() => { void load(); return () => { requestVersion.current += 1; }; }, [load]);

  return <div className="mt-7 space-y-6"><section aria-labelledby="portfolio-heading"><div className="mb-4"><h2 id="portfolio-heading" className="text-xl font-extrabold text-star-900">Portfolio</h2><p className="mt-1 text-sm text-star-muted">View your investment portfolio and holdings.</p></div>{portfolioState === "loading" ? <LoadingPanel label="Loading your portfolio…" /> : null}{portfolioState === "error" ? <RetryPanel title="Portfolio unavailable" message="We couldn’t load this portfolio right now." onRetry={() => { void load(); }} /> : null}{portfolioState === "ready" && portfolio ? <><PortfolioSummary portfolio={portfolio} /><section className="mt-5 rounded-xl border border-star-200 bg-white p-4 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><h3 className="text-lg font-extrabold text-star-900">Investment holdings</h3><p className="mt-1 text-sm text-star-muted">Your available holdings are shown below.</p><InvestmentHoldings holdings={portfolio.holdings} productsHref="/joint/products" /></section></> : null}</section><section aria-labelledby="recent-transactions-heading"><div className="mb-4"><h2 id="recent-transactions-heading" className="text-xl font-extrabold text-star-900">Account activity</h2><p className="mt-1 text-sm text-star-muted">Review recent transactions for this account.</p></div>{transactionsState === "loading" ? <LoadingPanel label="Loading transactions…" /> : null}{transactionsState === "error" ? <RetryPanel title="Transactions unavailable" message="We couldn’t load transactions right now." onRetry={() => { void load(); }} /> : null}{transactionsState === "ready" && transactions ? <RecentTransactions page={transactions} /> : null}</section></div>;
}

function AwaitingSecondHolder({ account }: { account: JointAccountSummary }) {
  if (!account.awaitingSecondHolder) return null;
  return <section className="mt-6 flex flex-col gap-4 rounded-xl border border-[#f4d5a5] bg-[#fff8e9] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold text-star-900">Invite a second account holder</h2><p className="mt-1 text-sm leading-6 text-star-muted">This account has one active holder. You can send or update an invitation from your Joint Profile.</p></div><Link href="/joint/profile" className="inline-flex min-h-10 w-fit items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Manage account holders</Link></section>;
}

export function JointDashboardContent() {
  const { accounts, accountsStatus, selectedAccount, selectedAccountId, refresh } = useJointAccounts();
  if (accountsStatus === "loading") return <LoadingPanel />;
  if (accountsStatus === "error") return <RetryPanel title="Joint Accounts unavailable" message="We couldn’t load your Joint Accounts right now." onRetry={() => { void refresh(); }} />;
  if (!accounts.length || !selectedAccountId || !selectedAccount) return <EmptyAccountState />;
  return <main><section><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint Account</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Joint Portfolio Overview</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">View your portfolio, holdings and recent account activity.</p><AccountSwitcher /></section><AwaitingSecondHolder account={selectedAccount} /><FinancialSnapshot key={selectedAccountId} jointAccountId={selectedAccountId} /></main>;
}
