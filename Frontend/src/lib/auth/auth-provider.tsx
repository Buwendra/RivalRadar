"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext, type AuthState } from "./auth-context";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import {
  storeTokens,
  clearTokens,
  hasStoredTokens,
  isTokenExpired,
} from "./token-storage";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const refreshUser = useCallback(async () => {
    try {
      const user = await usersApi.getProfile();
      setState({ user, isAuthenticated: true, isLoading: false });
    } catch {
      clearTokens();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (hasStoredTokens() && !isTokenExpired()) {
      refreshUser();
    } else {
      clearTokens();
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, [refreshUser]);

  // Check token expiry periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasStoredTokens() && isTokenExpired()) {
        clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false });
        router.push("/sign-in");
      }
    }, 60_000); // Check every minute

    return () => clearInterval(interval);
  }, [router]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.signIn({ email, password });
      storeTokens(tokens);
      const user = await usersApi.getProfile();
      setState({ user, isAuthenticated: true, isLoading: false });
    },
    []
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await authApi.signUp({ email, password, name });
      return { userId: result.userId };
    },
    []
  );

  const signOut = useCallback(() => {
    clearTokens();
    setState({ user: null, isAuthenticated: false, isLoading: false });
    router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({
      ...state,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [state, signIn, signUp, signOut, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
