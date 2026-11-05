"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { BarChart3, CheckCircle2, CircleAlert, CircleDollarSign, LoaderCircle, Mail, ReceiptText, RefreshCw, UserPlus, UsersRound, WalletCards } from "lucide-react";
import { createJointInvitation, getJointAccount, getJointPortfolio, getJointTransactions, type CreatedJointInvitation, type InvestorPortfolio, type InvestorTransactionsPage, type JointAccountDetail } from "@/lib/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { InvestmentHoldings } from "@/components/portal/InvestmentHoldings";
import { formatCurrencyMinor, formatDashboardDate } from "@/components/portal/dashboard-formatters";
import { formatJointDate, getJointActionErrorMessage } from "./joint-api-messages";
import { useJointAccounts } from "./JointAccountProvider";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type RequestState = "loading" | "ready" | "error";

function LoadingPanel({ label = "Resolving your authorized Joint Accounts…" }: { label?: string }) {
  return <div className="grid min-h-[300px] place-items-center rounded-xl border border-star-200 bg-white px-5 text-center"><div><LoaderCircle size={28} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">{label}</p></div></div>;
}

function RetryPanel({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return <div className="grid min-h-[250px] place-items-center rounded-xl border border-red-200 bg-white px-5 text-center"><div className="max-w-md"><CircleAlert size={28} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">{title}</h2><p className="mt-2 text-sm leading-6 text-star-muted">{message}</p><button type="button" onClick={onRetry} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></div>;
}

function EmptyAccountState() {
  const { invitations, invitationsStatus } = useJointAccounts();
  return <section className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div className="max-w-lg"><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><UsersRound size={23} aria-hidden="true" /></span><h1 className="mt-4 font-display text-2xl font-extrabold tracking-[-0.035em] text-star-900">No active Joint Accounts</h1>{invitationsStatus === "ready" && invitations.length ? <><p className="mt-2 text-sm leading-6 text-star-muted">You have {invitations.length} pending invitation{invitations.length === 1 ? "" : "s"}. Review an invitation before any account information becomes available.</p><Link href="/joint/invitations" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Review invitations</Link></> : <><p className="mt-2 text-sm leading-6 text-star-muted">Open a Joint Account as the first holder, or wait for an invitation from another verified investor.</p><Link href="/register/joint" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Open a Joint Account</Link></>}</div></section>;
}

function AccountSwitcher() {
  const { accounts, selectedAccountId, selectAccount } = useJointAccounts();
  if (accounts.length < 2) return null;
  return <label className="mt-5 block max-w-xl"><span className="text-sm font-extrabold text-star-900">Choose Joint Account</span><select value={selectedAccountId ?? ""} onChange={(event) => selectAccount(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm font-extrabold text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100">{accounts.map((account) => <option key={account.jointAccountId} value={account.jointAccountId}>{account.displayName}{account.awaitingSecondHolder ? " — awaiting second holder" : ""}</option>)}</select></label>;
}

function InvitationSender({ jointAccountId }: { jointAccountId: string }) {
  const { user } = useAuth();
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<CreatedJointInvitation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 254) {
      setError("Enter a valid email address.");
      return;
    }
    if (user && normalizedEmail === user.email.trim().toLowerCase()) {
      setError("You cannot invite your own email address.");
      return;
    }
    setError("");
    setResult(null);
    setSubmitting(true);
    try {
      setResult(await createJointInvitation(jointAccountId, normalizedEmail));
      setEmail("");
    } catch (requestError) {
      setError(getJointActionErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="mt-5 rounded-xl border border-[#d9eac8] bg-[linear-gradient(115deg,#fbfdf5_0%,#eff8e8_100%)] p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><Mail size={20} aria-hidden="true" /></span><div><h3 className="text-base font-extrabold text-star-900">Invite or re-invite the second holder</h3><p className="mt-1 text-sm leading-6 text-star-muted">This account has one active holder. Enter the second holder&apos;s email to create or replace a pending invitation. They must independently accept it.</p></div></div><form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Second holder email address</span><input id={emailId} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} autoComplete="email" maxLength={254} placeholder="second.holder@example.com" aria-invalid={Boolean(error)} className="h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm text-star-900 outline-none focus:border-star-700 focus:ring-2 focus:ring-star-100" /></label><button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}{submitting ? "Sending…" : "Create invitation"}</button></form>{error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}{result ? <p role="status" className="mt-3 text-sm leading-6 text-star-900">Pending invitation created for {result.invitedEmailMasked}; it expires {formatJointDate(result.expiresAt)}. Delivery status is not available here.</p> : null}</section>;
}

function PortfolioSummary({ portfolio }: { portfolio: InvestorPortfolio }) {
  const cards = [
    { label: "Portfolio value", value: formatCurrencyMinor(portfolio.totalValueMinor, portfolio.currency), detail: portfolio.totalValueMinor === null ? "Not available" : "Stored portfolio value", icon: WalletCards, emphasis: true },
    { label: "Holdings", value: portfolio.holdingCount === null ? "Not available" : String(portfolio.holdingCount), detail: portfolio.holdingCount === null ? "Not available" : "Reported holdings", icon: BarChart3, emphasis: false },
    { label: "Total return", value: portfolio.totalReturnMinor === null ? "Not available" : formatCurrencyMinor(portfolio.totalReturnMinor, portfolio.currency), detail: portfolio.totalReturnMinor === null ? "Not available" : "Server-reported return", icon: CircleDollarSign, emphasis: false },
  ];
  return <section className="grid gap-4 lg:grid-cols-3" aria-label="Joint portfolio summary">{cards.map(({ label, value, detail, icon: Icon, emphasis }) => <article key={label} className={`rounded-xl border p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] ${emphasis ? "border-[#d9eac8] bg-[linear-gradient(135deg,#f7faed_0%,#edf6de_100%)]" : "border-star-200 bg-white"}`}><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/80 text-star-700"><Icon size={23} aria-hidden="true" /></span><div><p className="text-sm font-semibold text-star-muted">{label}</p><p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-star-900">{value}</p><p className="mt-2 text-xs font-semibold text-star-muted">{detail}</p></div></div></article>)}</section>;
}

function RecentTransactions({ page }: { page: InvestorTransactionsPage }) {
  if (page.transactions.length === 0) return <section className="rounded-xl border border-dashed border-star-300 bg-star-50 px-5 py-9 text-center"><ReceiptText size={22} className="mx-auto text-star-700" aria-hidden="true" /><h3 className="mt-3 text-lg font-extrabold text-star-900">No transactions yet</h3><p className="mt-2 text-sm leading-6 text-star-muted">Recorded Joint Account activity will appear here when available.</p></section>;
  return <section className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-extrabold text-star-900">Recent transactions</h2><p className="mt-1 text-sm text-star-muted">Latest recorded activity on the selected Joint Account.</p></div><Link href="/joint/transactions" className="text-sm font-extrabold text-star-700 no-underline hover:text-star-900">View all</Link></div><div className="mt-5 divide-y divide-star-100">{page.transactions.map((transaction, index) => <article key={transaction.id ?? `transaction-${index}`} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0"><span className="grid size-10 place-items-center rounded-full bg-star-50 text-star-700"><ReceiptText size={18} aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="font-extrabold text-star-900">{transaction.description ?? transaction.type ?? "Recorded transaction"}</p><p className="mt-1 text-xs text-star-muted">{transaction.type ?? "Type not available"} <span aria-hidden="true">·</span> {formatDashboardDate(transaction.occurredAt)}</p></div><div className="text-right"><p className="font-extrabold tabular-nums text-star-900">{formatCurrencyMinor(transaction.amountMinor, transaction.currency)}</p><span className="mt-1 inline-flex rounded-full bg-star-100 px-2 py-0.5 text-xs font-bold text-star-700">{transaction.status ?? "Not available"}</span></div></article>)}</div></section>;
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
    if (portfolioResult.status === "fulfilled") {
      setPortfolio(portfolioResult.value);
      setPortfolioState("ready");
    } else {
      setPortfolioState("error");
    }
    if (transactionResult.status === "fulfilled") {
      setTransactions(transactionResult.value);
      setTransactionsState("ready");
    } else {
      setTransactionsState("error");
    }
  }, [jointAccountId]);

  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  return <div className="mt-6 space-y-5"><section aria-labelledby="portfolio-heading"><div className="mb-4"><h2 id="portfolio-heading" className="text-xl font-extrabold text-star-900">Portfolio overview</h2><p className="mt-1 text-sm text-star-muted">Read-only values reported for this authorized Joint Account.</p></div>{portfolioState === "loading" ? <LoadingPanel label="Loading portfolio data…" /> : null}{portfolioState === "error" ? <RetryPanel title="Portfolio data is unavailable" message="We could not load the selected Joint Account portfolio. No portfolio values are shown." onRetry={() => { void load(); }} /> : null}{portfolioState === "ready" && portfolio ? <><PortfolioSummary portfolio={portfolio} /><section className="mt-5 rounded-xl border border-star-200 bg-white p-4 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><h3 className="text-lg font-extrabold text-star-900">Portfolio holdings</h3><p className="mt-1 text-sm text-star-muted">Instrument values are stored values reported by the backend.</p><InvestmentHoldings holdings={portfolio.holdings} productsHref="/joint/products" /></section></> : null}</section><section aria-labelledby="recent-transactions-heading"><div className="mb-4"><h2 id="recent-transactions-heading" className="text-xl font-extrabold text-star-900">Account activity</h2><p className="mt-1 text-sm text-star-muted">Recent read-only transactions reported by the backend.</p></div>{transactionsState === "loading" ? <LoadingPanel label="Loading recent transactions…" /> : null}{transactionsState === "error" ? <RetryPanel title="Transactions are unavailable" message="We could not load transactions for the selected Joint Account. No transaction records are shown." onRetry={() => { void load(); }} /> : null}{transactionsState === "ready" && transactions ? <RecentTransactions page={transactions} /> : null}</section></div>;
}

function AccountDetail({ accountId }: { accountId: string }) {
  const { refresh } = useJointAccounts();
  const [detail, setDetail] = useState<JointAccountDetail | null>(null);
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);
  const [state, setState] = useState<RequestState>("loading");
  const requestVersion = useRef(0);

  const loadDetail = useCallback(async () => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setDetail(null);
    setDetailAccountId(null);
    setState("loading");
    try {
      const nextDetail = await getJointAccount(accountId);
      if (version !== requestVersion.current) return;
      setDetail(nextDetail);
      setDetailAccountId(accountId);
      setState("ready");
    } catch {
      if (version !== requestVersion.current) return;
      setDetailAccountId(accountId);
      setState("error");
      void refresh();
    }
  }, [accountId, refresh]);

  useEffect(() => {
    void loadDetail();
    return () => { requestVersion.current += 1; };
  }, [loadDetail]);

  const detailMatchesSelectedAccount = detailAccountId === accountId;
  if (state === "loading" || !detailMatchesSelectedAccount) return <LoadingPanel />;
  if (state === "error" || !detail) return <RetryPanel title="This Joint Account is unavailable" message="We could not confirm access to the selected Joint Account. No private account information is shown." onRetry={() => { void loadDetail(); }} />;

  const awaiting = detail.membership.awaitingSecondHolder;
  return <><section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]"><article className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-star-700">Authorized Joint Account</p><h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-star-900">{detail.displayName}</h2><p className="mt-2 text-sm leading-6 text-star-muted">Created {formatJointDate(detail.createdAt)}</p></div><span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${awaiting ? "bg-[#fff3d9] text-[#9a6200]" : "bg-[#e1f7e7] text-[#16743d]"}`}>{awaiting ? "Awaiting second holder" : "Two active holders"}</span></div><div className="mt-6 border-t border-star-100 pt-5"><h3 className="text-sm font-extrabold text-star-900">Active members</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{detail.members.map((member) => <div key={member.userId} className="rounded-lg border border-star-200 bg-star-50 p-4"><p className="font-extrabold text-star-900">{`${member.firstName} ${member.lastName}`.trim() || "Account holder"}</p><p className="mt-1 break-all text-sm text-star-muted">{member.email}</p><p className="mt-2 text-xs text-star-muted">Joined {formatJointDate(member.joinedAt)}</p></div>)}</div></div><p className="mt-5 text-sm leading-6 text-star-muted">Membership is confirmed by the backend. This does not represent KYC, investment approval, a signing mandate, or financial account verification.</p>{awaiting ? <InvitationSender jointAccountId={detail.jointAccountId} /> : null}</article><aside className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><h2 className="text-xl font-extrabold text-star-900">Account access</h2><p className="mt-2 text-sm leading-6 text-star-muted">This dashboard shows only account data the backend authorizes for the selected active membership.</p><div className="mt-5 rounded-lg border border-star-200 bg-star-50 p-4"><p className="text-sm font-extrabold text-star-900">Account capacity</p><p className="mt-1 text-sm text-star-muted">{detail.membership.activeCount} of {detail.membership.capacity} active holders</p></div></aside></section><FinancialSnapshot jointAccountId={detail.jointAccountId} /></>;
}

export function JointDashboardContent() {
  const { accounts, accountsStatus, selectedAccountId, refresh } = useJointAccounts();
  if (accountsStatus === "loading") return <LoadingPanel />;
  if (accountsStatus === "error") return <RetryPanel title="Joint Accounts are unavailable" message="We could not load the Joint Accounts available to this session. No account information is shown." onRetry={() => { void refresh(); }} />;
  if (!accounts.length || !selectedAccountId) return <EmptyAccountState />;
  return <main><section><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account overview</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Your Joint Accounts</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Select an account authorized for this signed-in investor. Membership, holdings, and recorded activity are confirmed by the backend for every selection.</p><AccountSwitcher /></section><AccountDetail accountId={selectedAccountId} /></main>;
}
