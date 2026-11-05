"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getMyJointAccounts, getMyJointInvitations, type JointAccountSummary, type JointInvitation } from "@/lib/api/client";
import { useAuth } from "@/components/auth/AuthProvider";

type ResourceStatus = "loading" | "ready" | "error";

type JointAccountContextValue = {
  accounts: JointAccountSummary[];
  invitations: JointInvitation[];
  selectedAccountId: string | null;
  selectedAccount: JointAccountSummary | null;
  accountsStatus: ResourceStatus;
  invitationsStatus: ResourceStatus;
  accountsError: unknown;
  invitationsError: unknown;
  selectAccount: (jointAccountId: string) => boolean;
  refresh: () => Promise<JointAccountSummary[]>;
};

const JointAccountContext = createContext<JointAccountContextValue | null>(null);

/**
 * Keeps Joint selection in React memory only. A selected ID is accepted only
 * when it appears in the current caller's authenticated R1 response.
 */
export function JointAccountProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [accounts, setAccounts] = useState<JointAccountSummary[]>([]);
  const [invitations, setInvitations] = useState<JointInvitation[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountsStatus, setAccountsStatus] = useState<ResourceStatus>("loading");
  const [invitationsStatus, setInvitationsStatus] = useState<ResourceStatus>("loading");
  const [accountsError, setAccountsError] = useState<unknown>(null);
  const [invitationsError, setInvitationsError] = useState<unknown>(null);
  const requestVersion = useRef(0);
  const accountRef = useRef<JointAccountSummary[]>([]);
  const loadedUserId = useRef<string | null>(null);

  const reset = useCallback(() => {
    requestVersion.current += 1;
    loadedUserId.current = null;
    accountRef.current = [];
    setAccounts([]);
    setInvitations([]);
    setSelectedAccountId(null);
    setAccountsError(null);
    setInvitationsError(null);
    setAccountsStatus("loading");
    setInvitationsStatus("loading");
  }, []);

  const refresh = useCallback(async (): Promise<JointAccountSummary[]> => {
    if (authStatus !== "authenticated" || !user) {
      reset();
      return [];
    }

    const isNewUser = loadedUserId.current !== user.id;
    if (isNewUser) {
      accountRef.current = [];
      setAccounts([]);
      setInvitations([]);
      setSelectedAccountId(null);
      loadedUserId.current = user.id;
    }

    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setAccountsStatus("loading");
    setInvitationsStatus("loading");
    setAccountsError(null);
    setInvitationsError(null);

    const [accountResult, invitationResult] = await Promise.allSettled([getMyJointAccounts(), getMyJointInvitations()]);
    if (version !== requestVersion.current || loadedUserId.current !== user.id) return [];

    let nextAccounts: JointAccountSummary[] = [];
    if (accountResult.status === "fulfilled") {
      nextAccounts = accountResult.value;
      accountRef.current = nextAccounts;
      setAccounts(nextAccounts);
      setAccountsStatus("ready");
      setSelectedAccountId((current) => nextAccounts.some((account) => account.jointAccountId === current) ? current : nextAccounts[0]?.jointAccountId ?? null);
    } else {
      accountRef.current = [];
      setAccounts([]);
      setSelectedAccountId(null);
      setAccountsError(accountResult.reason);
      setAccountsStatus("error");
    }

    if (invitationResult.status === "fulfilled") {
      setInvitations(invitationResult.value);
      setInvitationsStatus("ready");
    } else {
      setInvitations([]);
      setInvitationsError(invitationResult.reason);
      setInvitationsStatus("error");
    }

    return nextAccounts;
  }, [authStatus, reset, user]);

  useEffect(() => {
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  const selectAccount = useCallback((jointAccountId: string) => {
    if (!accountRef.current.some((account) => account.jointAccountId === jointAccountId)) return false;
    setSelectedAccountId(jointAccountId);
    return true;
  }, []);

  const selectedAccount = useMemo(() => accounts.find((account) => account.jointAccountId === selectedAccountId) ?? null, [accounts, selectedAccountId]);
  const value = useMemo<JointAccountContextValue>(() => ({
    accounts,
    invitations,
    selectedAccountId,
    selectedAccount,
    accountsStatus,
    invitationsStatus,
    accountsError,
    invitationsError,
    selectAccount,
    refresh,
  }), [accounts, accountsError, accountsStatus, invitations, invitationsError, invitationsStatus, refresh, selectAccount, selectedAccount, selectedAccountId]);

  return <JointAccountContext.Provider value={value}>{children}</JointAccountContext.Provider>;
}

export function useJointAccounts() {
  const context = useContext(JointAccountContext);
  if (!context) throw new Error("useJointAccounts must be used inside JointAccountProvider");
  return context;
}
