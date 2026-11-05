"use client";

import { Bell, CheckCircle2, Clock3, LoaderCircle, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { acceptJointInvitation, declineJointInvitation, getMyJointInvitations, type JointInvitation } from "@/lib/api/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { getInvitationMutationSuccessMessage, isCurrentNotificationSession, type NotificationSessionSnapshot } from "@/lib/auth/joint-notification-session";
import { formatJointDate, getJointActionErrorMessage } from "./joint-api-messages";

type InvitationState = "idle" | "loading" | "ready" | "error";
type InvitationAction = "accept" | "decline";
type Confirmation = { action: InvitationAction; invitation: JointInvitation; session: NotificationSessionSnapshot };

type JointInvitationNotificationsProps = {
  /** Refreshes Joint account membership after an accepted invitation in the Joint portal. */
  onAccepted?: (jointAccountId: string) => Promise<void> | void;
  /** Individual investors can continue into their Joint portal after accepting. */
  openJointAccountAfterAccept?: boolean;
};

function ConfirmationDialog({ confirmation, pending, onClose, onConfirm }: { confirmation: Confirmation; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  const accepting = confirmation.action === "accept";
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    cancelButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, pending]);
  return <div className="fixed inset-0 z-[100] grid place-items-center px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="notification-confirmation-title"><button type="button" onClick={onClose} disabled={pending} aria-label="Close confirmation" className="absolute inset-0 bg-star-900/55" /><section className="relative z-10 w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6"><button type="button" onClick={onClose} disabled={pending} aria-label="Close confirmation" className="absolute right-4 top-4 grid size-9 place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:opacity-50"><X size={19} aria-hidden="true" /></button><p className="text-xs font-extrabold uppercase tracking-[0.13em] text-star-700">Joint Account invitation</p><h2 id="notification-confirmation-title" className="mt-2 pr-9 text-xl font-extrabold text-star-900">{accepting ? "Accept this invitation?" : "Decline this invitation?"}</h2><p className="mt-3 text-sm leading-6 text-star-muted">{accepting ? `You will join ${confirmation.invitation.accountDisplayName} after you confirm.` : `Decline the invitation to ${confirmation.invitation.accountDisplayName}?`}</p><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button ref={cancelButtonRef} type="button" onClick={onClose} disabled={pending} className="min-h-10 rounded-md border border-star-200 px-4 text-sm font-extrabold text-star-700 transition hover:bg-star-50 disabled:opacity-50">Cancel</button><button type="button" onClick={onConfirm} disabled={pending} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${accepting ? "bg-star-lime text-star-900 hover:bg-[#c7f238]" : "bg-star-700 text-white hover:bg-star-800"}`}>{pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}{pending ? "Submitting…" : accepting ? "Accept invitation" : "Decline invitation"}</button></div></section></div>;
}

export function JointInvitationNotifications({ onAccepted, openJointAccountAfterAccept = false }: JointInvitationNotificationsProps) {
  const router = useRouter();
  const { status: authStatus, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [panelUserId, setPanelUserId] = useState<string | null>(null);
  const [state, setState] = useState<InvitationState>("idle");
  const [invitations, setInvitations] = useState<JointInvitation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pending, setPending] = useState(false);
  const requestVersion = useRef(0);
  const sessionRevision = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const activeUserId = authStatus === "authenticated" && user ? user.id : null;
  // Update synchronously during render so a completion cannot commit between an
  // auth-context re-render and its cleanup effect.
  if (activeUserIdRef.current !== activeUserId) {
    activeUserIdRef.current = activeUserId;
    sessionRevision.current += 1;
  }
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();
  const hasCurrentSession = (snapshot: NotificationSessionSnapshot) => isCurrentNotificationSession(snapshot, activeUserIdRef.current, sessionRevision.current);

  const clearForSessionChange = useCallback(() => {
    requestVersion.current += 1;
    setOpen(false);
    setPanelUserId(null);
    setInvitations([]);
    setState("idle");
    setError("");
    setMessage("");
    setConfirmation(null);
    setPending(false);
  }, []);

  const load = useCallback(async ({ preserveOnError = false }: { preserveOnError?: boolean } = {}) => {
    if (authStatus !== "authenticated" || !user) {
      clearForSessionChange();
      return false;
    }
    const session: NotificationSessionSnapshot = { userId: user.id, revision: sessionRevision.current };
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setState("loading");
    if (!preserveOnError) setError("");
    try {
      const nextInvitations = await getMyJointInvitations();
      if (version !== requestVersion.current || !hasCurrentSession(session)) return false;
      setInvitations(nextInvitations);
      setState("ready");
      return true;
    } catch (requestError) {
      if (version !== requestVersion.current || !hasCurrentSession(session)) return false;
      if (preserveOnError) {
        setState("ready");
        return false;
      }
      setInvitations([]);
      setState("error");
      setError(getJointActionErrorMessage(requestError));
      return false;
    }
  }, [authStatus, clearForSessionChange, user]);

  const panelOpen = open && panelUserId === activeUserId;
  const visibleConfirmation = confirmation && hasCurrentSession(confirmation.session) ? confirmation : null;

  useEffect(() => {
    clearForSessionChange();
    if (authStatus === "authenticated" && user) void load();
    return () => { requestVersion.current += 1; };
  }, [authStatus, clearForSessionChange, load, user]);

  useEffect(() => {
    if (!panelOpen || visibleConfirmation) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || pending || visibleConfirmation) return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [panelOpen, pending, visibleConfirmation]);

  function closePanel() {
    if (pending || visibleConfirmation) return;
    setOpen(false);
    triggerRef.current?.focus();
  }

  function openPanel() {
    if (authStatus !== "authenticated" || !user) return;
    setPanelUserId(user.id);
    setOpen(true);
    setMessage("");
    void load();
  }

  async function submitResponse() {
    if (!visibleConfirmation || pending) return;
    const current = visibleConfirmation;
    if (!hasCurrentSession(current.session)) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (current.action === "accept") {
        const result = await acceptJointInvitation(current.invitation.invitationId);
        if (!hasCurrentSession(current.session)) return;
        // Membership refresh is useful, but a refresh error must never turn a
        // confirmed acceptance into a misleading failure message.
        try {
          await onAccepted?.(result.jointAccountId);
        } catch {
          // The invitation result remains successful; the user can refresh later.
        }
        if (!hasCurrentSession(current.session)) return;
      } else {
        await declineJointInvitation(current.invitation.invitationId);
        if (!hasCurrentSession(current.session)) return;
      }

      // Remove the confirmed invitation immediately, then attempt M3 refresh.
      // A failed refresh keeps the confirmed outcome visible without claiming
      // that the mutation itself failed.
      setInvitations((items) => items.filter((item) => item.invitationId !== current.invitation.invitationId));
      setState("ready");
      setConfirmation(null);
      const inboxRefreshed = await load({ preserveOnError: true });
      if (!hasCurrentSession(current.session)) return;
      setError("");
      setConfirmation(null);
      setMessage(getInvitationMutationSuccessMessage(current.action, current.invitation.accountDisplayName, inboxRefreshed));
      if (current.action === "accept" && openJointAccountAfterAccept) {
        setOpen(false);
        setPanelUserId(null);
        router.push("/joint/dashboard");
      }
    } catch (requestError) {
      if (!hasCurrentSession(current.session)) return;
      setConfirmation(null);
      setError(getJointActionErrorMessage(requestError));
    } finally {
      if (hasCurrentSession(current.session)) setPending(false);
    }
  }

  if (authStatus !== "authenticated" || !user) return null;
  const hasPendingInvitations = state === "ready" && invitations.length > 0;

  return <><button ref={triggerRef} type="button" onClick={openPanel} aria-label={hasPendingInvitations ? `${invitations.length} pending Joint Account invitation${invitations.length === 1 ? "" : "s"}` : "Joint Account notifications"} aria-haspopup="dialog" aria-expanded={panelOpen} aria-controls={panelOpen ? dialogId : undefined} className="relative grid size-10 place-items-center rounded-full text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2"><Bell size={21} aria-hidden="true" />{hasPendingInvitations ? <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-extrabold leading-4 text-white ring-2 ring-white">{invitations.length > 9 ? "9+" : invitations.length}</span> : null}</button>{panelOpen ? <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-heading`}><button type="button" onClick={closePanel} aria-label="Close notifications" className="absolute inset-0 bg-star-900/25" /><section id={dialogId} className="absolute inset-x-3 top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-star-200 bg-white p-4 shadow-2xl sm:left-auto sm:right-5 sm:w-[min(30rem,calc(100vw-2.5rem))] sm:p-5 lg:right-8 xl:right-10"><div className="flex items-start justify-between gap-3 border-b border-star-100 pb-4"><div><p className="text-xs font-extrabold uppercase tracking-[0.12em] text-star-700">Notifications</p><h2 id={`${dialogId}-heading`} className="mt-1 text-xl font-extrabold text-star-900">Joint Account invitations</h2></div><div className="flex items-center gap-1"><button type="button" onClick={() => { void load(); }} disabled={state === "loading" || pending} className="grid size-9 place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Refresh invitations"><RefreshCw size={17} className={state === "loading" ? "animate-spin" : ""} aria-hidden="true" /></button><button ref={closeButtonRef} type="button" onClick={closePanel} disabled={pending} className="grid size-9 place-items-center rounded-md text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Close notifications"><X size={19} aria-hidden="true" /></button></div></div>{error ? <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm leading-6 text-red-700"><p>{error}</p><button type="button" onClick={() => { void load(); }} className="mt-2 font-extrabold underline underline-offset-2">Try again</button></div> : null}{message ? <p role="status" className="mt-4 rounded-lg border border-[#cce7d0] bg-[#eff8f0] px-3.5 py-3 text-sm leading-6 text-star-900">{message}</p> : null}{state === "loading" && invitations.length === 0 ? <div className="grid min-h-52 place-items-center px-4 text-center"><div><LoaderCircle size={25} className="mx-auto animate-spin text-star-700" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-star-muted">Loading invitations…</p></div></div> : null}{state === "ready" && invitations.length === 0 ? <div className="grid min-h-52 place-items-center px-4 text-center"><div><Bell size={24} className="mx-auto text-star-700" aria-hidden="true" /><h3 className="mt-3 text-lg font-extrabold text-star-900">No pending invitations</h3><p className="mt-2 max-w-sm text-sm leading-6 text-star-muted">New Joint Account invitations will appear here.</p></div></div> : null}{invitations.length ? <div className="mt-4 space-y-3">{invitations.map((invitation) => <article key={invitation.invitationId} className="rounded-lg border border-star-200 bg-star-50/70 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.1em] text-star-700">Pending invitation</p><h3 className="mt-1 truncate text-base font-extrabold text-star-900">{invitation.accountDisplayName}</h3><p className="mt-1 text-sm text-star-muted">From {invitation.inviterFirstName}</p></div><span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fff3d9] px-2 py-1 text-[11px] font-extrabold text-[#9a6200]"><Clock3 size={12} aria-hidden="true" />Pending</span></div><dl className="mt-3 grid gap-2 text-xs text-star-muted sm:grid-cols-2"><div><dt className="font-extrabold uppercase tracking-[0.06em]">Sent</dt><dd className="mt-1 font-semibold text-star-900">{formatJointDate(invitation.sentAt)}</dd></div><div><dt className="font-extrabold uppercase tracking-[0.06em]">Expires</dt><dd className="mt-1 font-semibold text-star-900">{formatJointDate(invitation.expiresAt)}</dd></div></dl><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setError(""); setMessage(""); setConfirmation({ action: "accept", invitation, session: { userId: user.id, revision: sessionRevision.current } }); }} disabled={pending} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-star-lime px-3 text-sm font-extrabold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60"><CheckCircle2 size={16} aria-hidden="true" />Accept</button><button type="button" onClick={() => { setError(""); setMessage(""); setConfirmation({ action: "decline", invitation, session: { userId: user.id, revision: sessionRevision.current } }); }} disabled={pending} className="min-h-10 rounded-md border border-star-200 bg-white px-3 text-sm font-extrabold text-star-700 transition hover:bg-star-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 disabled:cursor-not-allowed disabled:opacity-60">Decline</button></div></article>)}</div> : null}</section></div> : null}{visibleConfirmation ? <ConfirmationDialog confirmation={visibleConfirmation} pending={pending} onClose={() => { if (!pending) setConfirmation(null); }} onConfirm={() => { void submitResponse(); }} /> : null}</>;
}
