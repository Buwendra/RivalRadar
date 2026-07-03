"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext, type AuthState } from "./auth-context";
import { authApi } from "@/lib/api/auth";
import { usersApi } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import {
  storeTokens,
  clearTokens,
  hasStoredTokens,
  isTokenExpired,
  isTokenExpiringSoon,
} from "./token-storage";
import { refreshSession } from "./token-refresh";

const PROFILE_RETRY_ATTEMPTS = 2;
const PROFILE_RETRY_BASE_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Load the profile for the current session. Only a 401 proves the session
  // is dead — a network flake or a 500 on app load must NOT clear valid
  // tokens (it used to, producing random "logged out on refresh" reports).
  // Non-401 failures are retried with backoff; if they persist we surface
  // unauthenticated state but leave the tokens intact so the next page load
  // can recover.
  const refreshUser = useCallback(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const user = await usersApi.getProfile();
        setState({ user, isAuthenticated: true, isLoading: false });
        return;
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 401) {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        if (attempt < PROFILE_RETRY_ATTEMPTS) {
          await sleep(PROFILE_RETRY_BASE_MS * 2 ** attempt);
          continue;
        }
        setState({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (hasStoredTokens() && !isTokenExpired()) {
      refreshUser();
    } else if (hasStoredTokens()) {
      // Expired id token but a session may still be renewable — try the
      // refresh token before giving up.
      refreshSession().then((refreshed) => {
        if (refreshed) {
          refreshUser();
        } else {
          clearTokens();
          setState({ user: null, isAuthenticated: false, isLoading: false });
        }
      });
    } else {
      setState({ user: null, isAuthenticated: false, isLoading: false });
    }
  }, [refreshUser]);

  // Proactive session renewal: refresh BEFORE the ~1h id token lapses so
  // in-flight work never sees a 401. Deliberately no router.push here — this
  // interval runs on every page including public ones, and yanking a visitor
  // off the homepage because their old tokens expired is wrong. Redirects to
  // /sign-in are AuthGuard's job, and only on protected routes.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!hasStoredTokens() || !isTokenExpiringSoon()) return;

      const refreshed = await refreshSession();
      if (!refreshed && isTokenExpired()) {
        clearTokens();
        setState({ user: null, isAuthenticated: false, isLoading: false });
      }
    }, 60_000); // Check every minute

    return () => clearInterval(interval);
  }, []);

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
