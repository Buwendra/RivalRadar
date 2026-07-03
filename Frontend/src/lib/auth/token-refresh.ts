/**
 * Single-flight Cognito token refresh.
 *
 * Both the API client (reactive: got a 401) and the AuthProvider's expiry
 * timer (proactive: token is about to lapse) funnel through `refreshSession`.
 * The module-level promise guarantees at most ONE /auth/refresh call is in
 * flight no matter how many API calls hit 401 simultaneously — the rest await
 * the same result and then retry with the fresh token.
 *
 * Uses raw fetch deliberately: apiClient depends on this module for its 401
 * handling, so calling back into it would recurse.
 */
import { API_URL } from "@/lib/utils/constants";
import { getRefreshToken, storeRefreshedTokens } from "./token-storage";

let refreshPromise: Promise<boolean> | null = null;

/** Refresh the session. Resolves true on success, false on any failure. */
export function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;

    const json = (await response.json()) as {
      data?: { accessToken?: string; idToken?: string; expiresIn?: number };
    };
    const data = json.data;
    if (!data?.accessToken || !data.idToken) return false;

    // Cognito's refresh flow returns no new refresh token — keep the stored one.
    storeRefreshedTokens({
      accessToken: data.accessToken,
      idToken: data.idToken,
      expiresIn: data.expiresIn ?? 3600,
    });
    return true;
  } catch {
    // Network failure — NOT proof the session is dead. Callers decide whether
    // to retry later; they must not clear tokens on a transport error.
    return false;
  }
}
