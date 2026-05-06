import { apiClient } from "./client";
import type { ApiKeyListItem, ApiKeyCreated } from "@/lib/types";

export const apiKeysApi = {
  list: () => apiClient<ApiKeyListItem[]>("/workspaces/current/api-keys"),

  create: (name: string) =>
    apiClient<ApiKeyCreated>("/workspaces/current/api-keys", {
      method: "POST",
      body: { name },
    }),

  remove: (id: string) =>
    apiClient<{ id: string; revoked: boolean }>(
      `/workspaces/current/api-keys/${id}`,
      { method: "DELETE" }
    ),
};
