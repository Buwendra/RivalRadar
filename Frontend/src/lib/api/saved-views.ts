import { apiClient } from "./client";
import type { SavedView, SavedViewFilters } from "@/lib/types";

export const savedViewsApi = {
  list: () => apiClient<SavedView[]>("/saved-views"),

  create: (input: { name: string; filters: SavedViewFilters }) =>
    apiClient<SavedView>("/saved-views", { method: "POST", body: input }),

  update: (
    id: string,
    input: {
      name?: string;
      filters?: SavedViewFilters;
      webhookOnMatch?: boolean;
    }
  ) =>
    apiClient<SavedView>(`/saved-views/${id}`, {
      method: "PATCH",
      body: input,
    }),

  remove: (id: string) =>
    apiClient<{ id: string; deleted: boolean }>(`/saved-views/${id}`, {
      method: "DELETE",
    }),

  subscribe: (id: string) =>
    apiClient<{ viewId: string; subscribed: boolean }>(
      `/saved-views/${id}/subscribe`,
      { method: "POST" }
    ),

  unsubscribe: (id: string) =>
    apiClient<{ viewId: string; subscribed: boolean }>(
      `/saved-views/${id}/subscribe`,
      { method: "DELETE" }
    ),
};
