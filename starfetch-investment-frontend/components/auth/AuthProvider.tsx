"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ApiError,
  clearAccessToken,
  getCurrentUser,
  hasAccessToken,
  isApiError,
  type AuthUser,
  loginInvestor,
  logoutSession,
  refreshAccessToken,
  setAccessToken,
  setSessionExpiredListener,
} from "@/lib/api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

/**
 * What `refreshSession()` actually did to the provider's own state.
 *
 * Callers that must act on up-to-date authorisation (a Joint membership change,
 * for example) need to know whether `user` was really re-committed — not merely
 * whether some HTTP request happened to succeed. Returning the committed
 * projection keeps the provider the single source of truth and prevents a
 * second, independent `/me` read from being mistaken for the provider's state.
 */
export type SessionRefreshOutcome =
  /** The provider committed a fresh backend projection. */
  | { status: "refreshed"; user: AuthUser }
  /** The backend confirmed the session is gone; the provider cleared it. */
  | { status: "unauthenticated" }
  /** Transient failure: the previous authenticated state was deliberately kept. */
  | { status: "unchanged" }
  /** A newer operation owns the auth state; this refresh did not commit. */
  | { status: "superseded" }
  /** The initial restore failed transiently; the provider is in "error". */
  | { status: "error" };

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  login: (input: { email: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  invalidateSession: () => void;
  refreshSession: () => Promise<SessionRefreshOutcome>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Public calculators are deliberately self-contained: opening either one
  // must not initialize a session or make an authentication request. Existing
  // auth state is left intact for a user who navigates there from another route.
  //
  // Admin routes are added to this list for the same reason, and a stronger one.
  // Staff and investors are separate security principals with separate session
  // models: the admin portal authenticates against the staff backend with a
  // host-only staff cookie, never an investor token. If this provider ran on an
  // admin page it would issue an investor `/me` request from a staff session —
  // mixing the two boundaries for no benefit, and putting an investor-session
  // code path on the staff surface. Skipping is the correct behaviour, not a
  // workaround: no investor state is needed to render an admin page.
  const skipInitialSessionRefresh =
    pathname === "/tools/budget" ||
    pathname === "/tools/returns" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/");
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const operationRef = useRef(0);
  const statusRef = useRef<AuthStatus>("loading");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const commitUnauthenticated = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const invalidateSession = useCallback(() => {
    operationRef.current += 1;
    commitUnauthenticated();
  }, [commitUnauthenticated]);

  const refreshSession = useCallback(async (): Promise<SessionRefreshOutcome> => {
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    const wasAuthenticated = statusRef.current === "authenticated";
    // Keep the current session visible during a background re-refresh so a
    // transient failure cannot flash protected UI away or log the user out.
    if (!wasAuthenticated) {
      setUser(null);
      setStatus("loading");
    }

    try {
      await refreshAccessToken();
      const currentUser = await getCurrentUser();
      if (operation !== operationRef.current) return { status: "superseded" };
      setUser(currentUser);
      setStatus("authenticated");
      // The provider's own committed projection is what callers must trust.
      return { status: "refreshed", user: currentUser };
    } catch (error) {
      if (operation !== operationRef.current) return { status: "superseded" };
      // Only a backend-confirmed UNAUTHENTICATED ends the session. Network
      // errors, 5xx and rate limits are not proof of logout.
      if (isApiError(error) && error.code === "UNAUTHENTICATED") {
        commitUnauthenticated();
        return { status: "unauthenticated" };
      }
      if (wasAuthenticated && hasAccessToken()) {
        setStatus("authenticated");
        return { status: "unchanged" };
      }
      // Initial restore failed transiently: surface a retryable error
      // instead of redirecting to login.
      setUser(null);
      setStatus("error");
      return { status: "error" };
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
