import { apiClient } from "./client";
import type {
  IntegrationListItem,
  IntegrationProvider,
  SetIntegrationResponse,
} from "@/lib/types";

export const integrationsApi = {
  list: () => apiClient<IntegrationListItem[]>("/integrations"),

  set: (input: {
    provider: IntegrationProvider;
    url: string;
    meta?: Record<string, string>;
  }) =>
    apiClient<SetIntegrationResponse>("/integrations", {
      method: "POST",
      body: input,
    }),

  test: (provider: IntegrationProvider) =>
    apiClient<{ delivered: boolean }>(`/integrations/${provider}/test`, {
      method: "POST",
    }),

  remove: (provider: IntegrationProvider) =>
    apiClient<{ provider: IntegrationProvider; deleted: boolean }>(
      `/integrations/${provider}`,
      {
        method: "DELETE",
      }
    ),
};
