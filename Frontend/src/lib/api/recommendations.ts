import { apiClient, apiClientWithMeta } from "./client";
import type {
  Recommendation,
  RecommendationStatus,
  PaginationMeta,
} from "@/lib/types";

export interface RecommendationFilters {
  cursor?: string;
  limit?: number;
  status?: RecommendationStatus;
}

export interface RecommendationsListResponse {
  data: Recommendation[];
  meta: PaginationMeta;
}

export const recommendationsApi = {
  list: async (
    filters: RecommendationFilters = {}
  ): Promise<RecommendationsListResponse> => {
    const response = await apiClientWithMeta<Recommendation[]>(
      "/recommendations",
      {
        params: {
          cursor: filters.cursor,
          limit: filters.limit ?? 20,
          status: filters.status,
        },
      }
    );
    return {
      data: response.data ?? [],
      meta: response.meta ?? { hasMore: false },
    };
  },

  updateStatus: (id: string, status: RecommendationStatus) =>
    apiClient<{ id: string; status: RecommendationStatus }>(
      `/recommendations/${id}`,
      {
        method: "PATCH",
        body: { status },
      }
    ),
};
