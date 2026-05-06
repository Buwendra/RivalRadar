import { apiClientWithMeta } from "./client";
import { apiClient } from "./client";
import type {
  Change,
  ChangeDetail,
  ChangeFilters,
  ChangeNote,
  PaginationMeta,
} from "@/lib/types";

export interface ChangesListResponse {
  data: Change[];
  meta: PaginationMeta;
}

export const changesApi = {
  list: async (filters: ChangeFilters = {}): Promise<ChangesListResponse> => {
    const response = await apiClientWithMeta<Change[]>("/changes", {
      params: {
        cursor: filters.cursor,
        limit: filters.limit ?? 20,
        minSignificance: filters.minSignificance,
        competitorId: filters.competitorId,
        changeTypes: filters.changeTypes?.join(","),
        sinceDays: filters.sinceDays,
      },
    });
    return {
      data: response.data ?? [],
      meta: response.meta ?? { hasMore: false },
    };
  },

  get: (id: string) => apiClient<ChangeDetail>(`/changes/${id}`),

  feedback: (id: string, helpful: boolean) =>
    apiClient<{ message: string }>(`/changes/${id}/feedback`, {
      method: "POST",
      body: { helpful },
    }),

  listNotes: (changeId: string) =>
    apiClient<ChangeNote[]>(`/changes/${changeId}/notes`),

  createNote: (changeId: string, body: string) =>
    apiClient<ChangeNote>(`/changes/${changeId}/notes`, {
      method: "POST",
      body: { body },
    }),
};
