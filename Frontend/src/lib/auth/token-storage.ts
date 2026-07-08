const KEYS = {
  ACCESS_TOKEN: "kx_access_token",
  ID_TOKEN: "kx_id_token",
  REFRESH_TOKEN: "kx_refresh_token",
  EXPIRES_AT: "kx_expires_at",
} as const;

export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(KEYS.ID_TOKEN, tokens.idToken);
  localStorage.setItem(KEYS.REFRESH_TOKEN, tokens.refreshToken);
  const expiresAt = Date.now() + tokens.expiresIn * 1000;
  localStorage.setItem(KEYS.EXPIRES_AT, String(expiresAt));
}

/**
 * Store the outcome of a token refresh. Cognito's REFRESH_TOKEN_AUTH flow
 * does not return a new refresh token, so this variant deliberately leaves
 * the stored one untouched (calling storeTokens with `undefined` would blank
 * it and kill the session's renewability).
 */
export function storeRefreshedTokens(tokens: {
  accessToken: string;
  idToken: string;
  expiresIn: number;
}): void {
  localStorage.setItem(KEYS.ACCESS_TOKEN, tokens.accessToken);
  localStorage.setItem(KEYS.ID_TOKEN, tokens.idToken);
  const expiresAt = Date.now() + tokens.expiresIn * 1000;
  localStorage.setItem(KEYS.EXPIRES_AT, String(expiresAt));
}

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEYS.REFRESH_TOKEN);
}

export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(KEYS.EXPIRES_AT);
  if (!expiresAt) return true;
  return Date.now() >= Number(expiresAt);
}

/**
 * True when the token expires within the next 2 minutes. The proactive
 * refresh timer keys off this so the session renews BEFORE requests start
 * failing (and the buffer absorbs client-clock skew).
 */
export function isTokenExpiringSoon(): boolean {
  const expiresAt = localStorage.getItem(KEYS.EXPIRES_AT);
  if (!expiresAt) return true;
  return Date.now() >= Number(expiresAt) - 120_000;
}

export function clearTokens(): void {
  localStorage.removeItem(KEYS.ACCESS_TOKEN);
  localStorage.removeItem(KEYS.ID_TOKEN);
  localStorage.removeItem(KEYS.REFRESH_TOKEN);
  localStorage.removeItem(KEYS.EXPIRES_AT);
}

export function hasStoredTokens(): boolean {
  return !!localStorage.getItem(KEYS.ACCESS_TOKEN);
}
