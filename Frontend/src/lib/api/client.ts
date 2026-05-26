import { API_URL } from "@/lib/utils/constants";
import type { ApiResponse } from "@/lib/types";

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

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, params, requireAuth = true } = options;

  let url = `${API_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requireAuth) {
    const token = localStorage.getItem("rs_id_token");
    if (!token) {
      window.location.href = "/sign-in";
      throw new ApiClientError("UNAUTHENTICATED", 401, "Not authenticated");
    }
    headers["Authorization"] = `Bearer ${token}`;

    const workspaceId = localStorage.getItem("rs_current_workspace_id");
    if (workspaceId) {
      headers["X-Workspace-Id"] = workspaceId;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Only treat 401 as a session expiry when the caller was sending a token.
  // On `requireAuth: false` (sign-in, sign-up, public token routes) a 401 is
  // the server's domain response — e.g. wrong password — and the caller is
  // expected to surface it inline rather than being bounced to /sign-in.
  if (response.status === 401 && requireAuth) {
    localStorage.removeItem("rs_access_token");
    localStorage.removeItem("rs_id_token");
    localStorage.removeItem("rs_refresh_token");
    localStorage.removeItem("rs_expires_at");
    window.location.href = "/sign-in";
    throw new ApiClientError("UNAUTHENTICATED", 401, "Session expired");
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

  return json.data as T;
}

export async function apiClientWithMeta<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, params, requireAuth = true } = options;

  let url = `${API_URL}${endpoint}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value));
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requireAuth) {
    const token = localStorage.getItem("rs_id_token");
    if (!token) {
      window.location.href = "/sign-in";
      throw new ApiClientError("UNAUTHENTICATED", 401, "Not authenticated");
    }
    headers["Authorization"] = `Bearer ${token}`;

    const workspaceId = localStorage.getItem("rs_current_workspace_id");
    if (workspaceId) {
      headers["X-Workspace-Id"] = workspaceId;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && requireAuth) {
    localStorage.removeItem("rs_access_token");
    localStorage.removeItem("rs_id_token");
    localStorage.removeItem("rs_refresh_token");
    localStorage.removeItem("rs_expires_at");
    window.location.href = "/sign-in";
    throw new ApiClientError("UNAUTHENTICATED", 401, "Session expired");
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
