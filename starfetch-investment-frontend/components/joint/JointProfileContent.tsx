"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, LoaderCircle, RefreshCw, ShieldAlert, UsersRound } from "lucide-react";
import { getJointAccount, type JointAccountDetail } from "@/lib/api/client";
import { formatJointDate, getJointActionErrorMessage } from "./joint-api-messages";
import { JointInvitationSender } from "./JointInvitationSender";
import { useJointAccounts } from "./JointAccountProvider";

type RequestState = "idle" | "loading" | "ready" | "error";

function LoadingState() {
  return <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-star-200 bg-white px-5 py-10 text-center"><div><LoaderCircle size={28} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Loading Joint Account details…</p></div></section>;
}

function SelectedAccountRequired() {
  return <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div className="max-w-lg"><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><UsersRound size={23} aria-hidden="true" /></span><h2 className="mt-4 text-xl font-extrabold text-star-900">Select a Joint Account</h2><p className="mt-2 text-sm leading-6 text-star-muted">Choose a Joint Account to view the account holders and account details.</p><Link href="/joint/dashboard" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md bg-star-700 px-4 text-sm font-extrabold text-white no-underline transition hover:bg-star-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Go to dashboard</Link></div></section>;
}

export function JointProfileContent() {
  const { accountsStatus, accountsError, selectedAccount, refresh } = useJointAccounts();
  const accountId = selectedAccount?.jointAccountId ?? null;
  const [state, setState] = useState<RequestState>("idle");
  const [detail, setDetail] = useState<JointAccountDetail | null>(null);
  const [resultAccountId, setResultAccountId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const requestVersion = useRef(0);

  const loadDetail = useCallback(async () => {
    if (!accountId) {
      requestVersion.current += 1;
      setDetail(null);
      setResultAccountId(null);
      setError(null);
      setState("idle");
      return;
    }
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setDetail(null);
    setResultAccountId(null);
    setError(null);
    setState("loading");
    try {
      const nextDetail = await getJointAccount(accountId);
      if (version !== requestVersion.current) return;
      setDetail(nextDetail);
      setResultAccountId(accountId);
      setState("ready");
    } catch (requestError) {
      if (version !== requestVersion.current) return;
      setError(requestError);
      setResultAccountId(accountId);
      setState("error");
    }
  }, [accountId]);

  useEffect(() => {
    void loadDetail();
    return () => { requestVersion.current += 1; };
  }, [loadDetail]);

  const resultMatchesSelectedAccount = resultAccountId === accountId;

  return <main><section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint Account</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Joint Profile</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Review account holders and account details.</p></div>{accountId ? <button type="button" onClick={() => { void loadDetail(); }} disabled={state === "loading"} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60"><RefreshCw size={16} className={state === "loading" ? "animate-spin" : ""} aria-hidden="true" />Refresh</button> : null}</section>{accountsStatus === "loading" ? <LoadingState /> : null}{accountsStatus === "error" ? <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-red-200 bg-white px-5 py-10 text-center"><div className="max-w-md"><CircleAlert size={25} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">Joint Account details unavailable</h2><p className="mt-2 text-sm leading-6 text-star-muted">{getJointActionErrorMessage(accountsError)}</p><button type="button" onClick={() => { void refresh(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section> : null}{accountsStatus === "ready" && !accountId ? <SelectedAccountRequired /> : null}{accountsStatus === "ready" && accountId && (state === "loading" || !resultMatchesSelectedAccount) ? <LoadingState /> : null}{accountsStatus === "ready" && accountId && resultMatchesSelectedAccount && state === "error" ? <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-red-200 bg-white px-5 py-10 text-center"><div className="max-w-md"><CircleAlert size={25} className="mx-auto text-red-700" aria-hidden="true" /><h2 className="mt-4 text-xl font-extrabold text-star-900">Profile unavailable</h2><p className="mt-2 text-sm leading-6 text-star-muted">{getJointActionErrorMessage(error)}</p><button type="button" onClick={() => { void loadDetail(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section> : null}{accountsStatus === "ready" && accountId && resultMatchesSelectedAccount && state === "ready" && detail ? <><section className="mt-7 rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-lg bg-star-100 text-star-700"><UsersRound size={24} aria-hidden="true" /></span><div><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-star-700">Selected Joint Account</p><h2 className="mt-1 text-2xl font-extrabold text-star-900">{detail.displayName}</h2><p className="mt-2 text-sm text-star-muted">Opened {formatJointDate(detail.createdAt)}</p></div></div><span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-extrabold ${detail.membership.awaitingSecondHolder ? "bg-[#fff3d9] text-[#9a6200]" : "bg-[#e1f7e7] text-[#16743d]"}`}>{detail.membership.awaitingSecondHolder ? "Second holder pending" : "Two active account holders"}</span></div><div className="mt-6 rounded-lg border border-star-200 bg-star-50 p-4"><p className="text-sm font-extrabold text-star-900">Account holders</p><p className="mt-1 text-sm leading-6 text-star-muted">{detail.membership.activeCount} of {detail.membership.capacity} active account holder{detail.membership.activeCount === 1 ? "" : "s"}.</p></div></section><section className="mt-5" aria-labelledby="joint-members-heading"><h2 id="joint-members-heading" className="text-xl font-extrabold text-star-900">Account holders</h2><div className="mt-4 grid gap-4 lg:grid-cols-2">{detail.members.map((member, index) => <article key={member.userId} className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)]"><p className="text-xs font-extrabold uppercase tracking-[0.09em] text-star-700">{index === 0 ? "First account holder" : "Second account holder"}</p><p className="mt-2 text-lg font-extrabold text-star-900">{`${member.firstName} ${member.lastName}`.trim() || "Account holder"}</p><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-muted">Contact email</dt><dd className="mt-1 break-all font-semibold text-star-900">{member.email}</dd></div><div><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-muted">Joined</dt><dd className="mt-1 font-semibold text-star-900">{formatJointDate(member.joinedAt)}</dd></div></dl></article>)}</div></section>{detail.membership.awaitingSecondHolder ? <JointInvitationSender key={detail.jointAccountId} jointAccountId={detail.jointAccountId} /> : null}</> : null}<section className="mt-6 rounded-xl border border-[#f4d5a5] bg-[#fff8e9] p-5"><div className="flex gap-3"><ShieldAlert size={21} className="mt-0.5 shrink-0 text-[#9a6200]" aria-hidden="true" /><div><h2 className="text-lg font-extrabold text-star-900">Identity verification is not yet available</h2><p className="mt-2 text-sm leading-6 text-star-muted">Identity verification, employment and source-of-funds information, next of kin, bank details, PEP declarations, risk profile, documents, and signing mandates cannot be managed here.</p></div></div></section></main>;
}
