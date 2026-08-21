"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import { fetchCurrentUser, logoutFromFrappe } from "@/lib/frappe/auth";
import type { FrappeUser } from "@/types/frappe-user";

type AuthContextValue = {
  user: FrappeUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Mounted once in the root layout, seeded with the user resolved server-side
// (getServerUser()) so there's no loading flash on first paint. `refresh`/
// `logout` are for client-triggered updates (e.g. after the login form's own
// fetch call, which the server-rendered initialUser can't see until the next
// full navigation).
export function AuthProvider({
  initialUser,
  children,
}: {
  readonly initialUser: FrappeUser | null;
  readonly children: ReactNode;
}) {
  const [user, setUser] = useState<FrappeUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setUser(await fetchCurrentUser());
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutFromFrappe();
    setUser(null);
    router.replace("/auth/login");
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ user, isLoading, refresh, logout }), [user, isLoading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
