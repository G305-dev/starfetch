"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  clearAccessToken,
  getCurrentUser,
  type AuthUser,
  loginIndividual,
  logoutSession,
  refreshAccessToken,
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
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const invalidateSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const refreshSession = useCallback(async () => {
    setStatus("loading");
    try {
      await refreshAccessToken();
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setStatus("authenticated");
    } catch {
      invalidateSession();
    }
  }, [invalidateSession]);

  // The admin preview is mock-only and must not refresh an investor session.
  // Investor routes retain their existing session initialization behavior.
  const pathname = usePathname();
  const isAdminPreview = pathname === "/admin" || pathname.startsWith("/admin/");
  useEffect(() => {
    if (!isAdminPreview) void refreshSession();
  }, [isAdminPreview, refreshSession]);

  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const result = await loginIndividual({ email, password });
    try {
      const currentUser = result.user ?? await getCurrentUser();
      setUser(currentUser);
      setStatus("authenticated");
      return currentUser;
    } catch (error) {
      invalidateSession();
      throw error;
    }
  }, [invalidateSession]);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      invalidateSession();
    }
  }, [invalidateSession]);

  const value = useMemo<AuthContextValue>(() => ({ status, user, login, logout, invalidateSession, refreshSession }), [invalidateSession, login, logout, refreshSession, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
