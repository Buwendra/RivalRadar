import { apiClientWithMeta } from "./client";
import { apiClient } from "./client";
import type { Change, ChangeDetail, ChangeFilters, PaginationMeta } from "@/lib/types";

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
};
