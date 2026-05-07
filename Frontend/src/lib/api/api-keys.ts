import { apiClient } from "./client";
import type { ApiKeyListItem, ApiKeyCreated, ApiKeyScope } from "@/lib/types";

export const apiKeysApi = {
  list: () => apiClient<ApiKeyListItem[]>("/workspaces/current/api-keys"),

  create: (input: { name: string; scope: ApiKeyScope }) =>
    apiClient<ApiKeyCreated>("/workspaces/current/api-keys", {
      method: "POST",
      body: input,
    }),

  remove: (id: string) =>
    apiClient<{ id: string; revoked: boolean }>(
      `/workspaces/current/api-keys/${id}`,
      { method: "DELETE" }
    ),
};
