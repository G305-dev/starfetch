"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ApiError,
  clearAccessToken,
  getCurrentUser,
  type AuthUser,
  loginInvestor,
  logoutSession,
  refreshAccessToken,
  setAccessToken,
  setSessionExpiredListener,
} from "@/lib/api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  invalidateSession: () => void;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Public calculators are deliberately self-contained: opening either one
  // must not initialize a session or make an authentication request. Existing
  // auth state is left intact for a user who navigates there from another route.
  const skipInitialSessionRefresh = pathname === "/tools/budget" || pathname === "/tools/returns";
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const operationRef = useRef(0);

  const commitUnauthenticated = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const invalidateSession = useCallback(() => {
    operationRef.current += 1;
    commitUnauthenticated();
  }, [commitUnauthenticated]);

  const refreshSession = useCallback(async () => {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setUser(null);
    setStatus("loading");

    try {
      await refreshAccessToken();
      const currentUser = await getCurrentUser();
      if (operation !== operationRef.current) return;
      setUser(currentUser);
      setStatus("authenticated");
    } catch {
      if (operation !== operationRef.current) return;
      commitUnauthenticated();
    }
  }, [commitUnauthenticated]);

  useEffect(() => {
    const removeSessionExpiredListener = setSessionExpiredListener(invalidateSession);
    if (!skipInitialSessionRefresh) void refreshSession();
    return removeSessionExpiredListener;
  }, [invalidateSession, refreshSession, skipInitialSessionRefresh]);

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    setUser(null);
    setStatus("loading");

    try {
      const result = await loginInvestor({ email, password });
      if (operation !== operationRef.current) throw new ApiError("UNAUTHENTICATED");
      setAccessToken(result.accessToken);
      const currentUser = result.user ?? await getCurrentUser();
      if (operation !== operationRef.current) throw new ApiError("UNAUTHENTICATED");
      setUser(currentUser);
      setStatus("authenticated");
      return currentUser;
    } catch (error) {
      if (operation === operationRef.current) commitUnauthenticated();
      throw error;
    }
  }, [commitUnauthenticated]);

  const logout = useCallback(async () => {
    operationRef.current += 1;
    // Clear local authority first so an in-flight refresh cannot reveal private UI.
    commitUnauthenticated();
    try {
      await logoutSession();
    } catch {
      // Local session state remains safely cleared when the network is unavailable.
    }
  }, [commitUnauthenticated]);

  const value = useMemo<AuthContextValue>(() => ({ status, user, login, logout, invalidateSession, refreshSession }), [invalidateSession, login, logout, refreshSession, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
