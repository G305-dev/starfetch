"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Clock3, LoaderCircle, Mail, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { acceptJointInvitation, declineJointInvitation, type JointInvitation } from "@/lib/api/client";
import { formatJointDate, getJointActionErrorMessage } from "./joint-api-messages";
import { useJointAccounts } from "./JointAccountProvider";

type InvitationAction = "accept" | "decline";
type Confirmation = { invitation: JointInvitation; action: InvitationAction };

function LoadingState() {
  return <div className="grid min-h-[320px] place-items-center rounded-xl border border-star-200 bg-white px-5 text-center"><div><LoaderCircle size={28} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-4 text-sm font-semibold text-star-muted">Loading your pending invitations…</p></div></div>;
}

function ConfirmationDialog({ confirmation, onClose, onConfirm, pending }: { confirmation: Confirmation; onClose: () => void; onConfirm: () => void; pending: boolean }) {
  const accepting = confirmation.action === "accept";
  return <div className="fixed inset-0 z-[90] grid place-items-center px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="joint-invitation-confirmation-title"><button type="button" onClick={onClose} disabled={pending} aria-label="Close confirmation" className="absolute inset-0 bg-star-900/55" /><section className="relative z-10 w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6"><button type="button" onClick={onClose} disabled={pending} aria-label="Close confirmation" className="absolute right-4 top-4 grid size-9 place-items-center rounded-md text-star-700 hover:bg-star-50 disabled:opacity-50"><X size={19} aria-hidden="true" /></button><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-star-700">Joint Account invitation</p><h2 id="joint-invitation-confirmation-title" className="mt-2 pr-9 text-xl font-extrabold text-star-900">{accepting ? "Accept this invitation?" : "Decline this invitation?"}</h2><p className="mt-3 text-sm leading-6 text-star-muted">{accepting ? `Accepting adds you to ${confirmation.invitation.accountDisplayName} after you confirm.` : `Declining removes this pending invitation to ${confirmation.invitation.accountDisplayName}. You will not be added to this account.`}</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={pending} className="min-h-10 rounded-md border border-star-200 px-4 text-sm font-extrabold text-star-700 hover:bg-star-50 disabled:opacity-50">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-extrabold disabled:opacity-60 ${accepting ? "bg-star-lime text-star-900 hover:bg-[#c7f238]" : "bg-star-700 text-white hover:bg-star-800"}`}>{pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}{pending ? "Submitting…" : accepting ? "Accept invitation" : "Decline invitation"}</button></div></section></div>;
}

function InvitationCard({ invitation, onRespond }: { invitation: JointInvitation; onRespond: (action: InvitationAction, invitation: JointInvitation) => void }) {
  return <article className="rounded-xl border border-star-200 bg-white p-5 shadow-[0_2px_12px_rgba(14,62,46,0.04)] sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Pending invitation</p><h2 className="mt-2 text-xl font-extrabold text-star-900">{invitation.accountDisplayName}</h2><p className="mt-2 text-sm leading-6 text-star-muted">{invitation.inviterFirstName} invited you to become a Joint Account holder. You will join only after you accept.</p></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#fff3d9] px-2.5 py-1 text-xs font-extrabold text-[#9a6200]"><Clock3 size={14} aria-hidden="true" />Pending</span></div><dl className="mt-5 grid gap-3 border-y border-star-100 py-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-muted">Sent</dt><dd className="mt-1 font-semibold text-star-900">{formatJointDate(invitation.sentAt)}</dd></div><div><dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-star-muted">Expires</dt><dd className="mt-1 font-semibold text-star-900">{formatJointDate(invitation.expiresAt)}</dd></div></dl><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => onRespond("accept", invitation)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-star-lime px-4 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><CheckCircle2 size={17} aria-hidden="true" />Accept</button><button type="button" onClick={() => onRespond("decline", invitation)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-star-200 px-4 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700">Decline</button></div></article>;
}

export function JointInvitationsContent() {
  const router = useRouter();
  const { invitations, invitationsStatus, invitationsError, refresh, selectAccount } = useJointAccounts();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function confirm() {
    if (!confirmation || pending) return;
    const current = confirmation;
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (current.action === "accept") {
        const response = await acceptJointInvitation(current.invitation.invitationId);
        const accounts = await refresh();
        setConfirmation(null);
        if (accounts.some((account) => account.jointAccountId === response.jointAccountId) && selectAccount(response.jointAccountId)) {
          router.push("/joint/dashboard");
          return;
        }
        setMessage("Your invitation was accepted. Your Joint Account will appear when available.");
      } else {
        await declineJointInvitation(current.invitation.invitationId);
        await refresh();
        setConfirmation(null);
        setMessage("The invitation was declined and removed from your pending inbox.");
      }
    } catch (requestError) {
      setConfirmation(null);
      setError(getJointActionErrorMessage(requestError));
      void refresh();
    } finally {
      setPending(false);
    }
  }

  if (invitationsStatus === "loading") return <LoadingState />;
  if (invitationsStatus === "error") return <section className="grid min-h-[320px] place-items-center rounded-xl border border-red-200 bg-white px-5 text-center"><div className="max-w-md"><CircleAlert size={28} className="mx-auto text-red-700" aria-hidden="true" /><h1 className="mt-4 text-xl font-extrabold text-star-900">Invitations are unavailable</h1><p className="mt-2 text-sm leading-6 text-star-muted">{getJointActionErrorMessage(invitationsError)}</p><button type="button" onClick={() => { void refresh(); }} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-star-700 px-4 text-sm font-extrabold text-white"><RefreshCw size={16} aria-hidden="true" />Try again</button></div></section>;

  return <main><section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-700">Joint account access</p><h1 className="mt-2 font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold tracking-[-0.045em] text-star-900">Invitation inbox</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-star-muted sm:text-base">Review your pending Joint Account invitations and choose whether to accept.</p></div><button type="button" onClick={() => { void refresh(); }} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-star-200 bg-white px-4 text-sm font-extrabold text-star-700 hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700"><RefreshCw size={16} aria-hidden="true" />Refresh</button></section>{error ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</p> : null}{message ? <p role="status" className="mt-5 rounded-lg border border-[#cce7d0] bg-[#eff8f0] px-4 py-3 text-sm leading-6 text-star-900">{message}</p> : null}{invitations.length ? <section className="mt-7 grid gap-5 lg:grid-cols-2">{invitations.map((invitation) => <InvitationCard key={invitation.invitationId} invitation={invitation} onRespond={(action, item) => { setError(""); setMessage(""); setConfirmation({ action, invitation: item }); }} />)}</section> : <section className="mt-7 grid min-h-[300px] place-items-center rounded-xl border border-dashed border-star-300 bg-star-50/65 px-5 py-10 text-center"><div className="max-w-md"><span className="mx-auto grid size-12 place-items-center rounded-full bg-white text-star-700 shadow-sm"><Mail size={23} aria-hidden="true" /></span><h2 className="mt-4 text-xl font-extrabold text-star-900">No pending invitations</h2><p className="mt-2 text-sm leading-6 text-star-muted">New Joint Account invitations will appear here.</p></div></section>}{confirmation ? <ConfirmationDialog confirmation={confirmation} pending={pending} onClose={() => { if (!pending) setConfirmation(null); }} onConfirm={() => { void confirm(); }} /> : null}</main>;
}
