import { API_URL } from "@/lib/utils/constants";
import type { ApiResponse } from "@/lib/types";
import { clearTokens } from "@/lib/auth/token-storage";
import { refreshSession } from "@/lib/auth/token-refresh";

export class ApiClientError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | undefined>;
  requireAuth?: boolean;
}

function buildUrl(endpoint: string, params?: RequestOptions["params"]): string {
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

/** Redirect to sign-in, preserving the page the user was on (AuthGuard parity). */
function redirectToSignIn(): void {
  const returnTo = window.location.pathname + window.location.search;
  window.location.href = `/sign-in?redirect=${encodeURIComponent(returnTo)}`;
}

function authHeaders(requireAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!requireAuth) return headers;

  const token = localStorage.getItem("kx_id_token");
  if (!token) {
    redirectToSignIn();
    throw new ApiClientError("UNAUTHENTICATED", 401, "Not authenticated");
  }
  headers["Authorization"] = `Bearer ${token}`;

  const workspaceId = localStorage.getItem("kx_current_workspace_id");
  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }
  return headers;
}

/**
 * Shared request core for both client variants.
 *
 * 401 handling (authed requests only — on `requireAuth: false` a 401 is the
 * server's domain response, e.g. wrong password, surfaced to the caller):
 * attempt ONE single-flight token refresh and replay the request with the
 * fresh token. Only when refresh fails — or the replay still 401s — is the
 * session truly over: clear tokens and bounce to sign-in with a return path.
 * Before this, every id-token expiry (~1h) hard-logged the user out even
 * though a valid 30-day refresh token sat unused in storage.
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions
): Promise<ApiResponse<T>> {
  const { method = "GET", body, params, requireAuth = true } = options;
  const url = buildUrl(endpoint, params);
  const init = (headers: Record<string, string>): RequestInit => ({
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let response = await fetch(url, init(authHeaders(requireAuth)));

  if (response.status === 401 && requireAuth) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await fetch(url, init(authHeaders(requireAuth)));
    }
    if (!refreshed || response.status === 401) {
      clearTokens();
      redirectToSignIn();
      throw new ApiClientError("UNAUTHENTICATED", 401, "Session expired");
    }
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (json.error) {
    throw new ApiClientError(
      json.error.code,
      response.status,
      json.error.message,
      json.error.details
    );
  }

  return json;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const json = await request<T>(endpoint, options);
  return json.data as T;
}

export async function apiClientWithMeta<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  return request<T>(endpoint, options);
}
