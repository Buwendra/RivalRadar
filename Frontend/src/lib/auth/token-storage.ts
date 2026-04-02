const KEYS = {
  ACCESS_TOKEN: "rs_access_token",
  ID_TOKEN: "rs_id_token",
  REFRESH_TOKEN: "rs_refresh_token",
  EXPIRES_AT: "rs_expires_at",
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

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.ACCESS_TOKEN);
}

export function isTokenExpired(): boolean {
  const expiresAt = localStorage.getItem(KEYS.EXPIRES_AT);
  if (!expiresAt) return true;
  return Date.now() >= Number(expiresAt);
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
