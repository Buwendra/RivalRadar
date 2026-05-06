import { apiClient } from "./client";
import type { SearchResponse } from "@/lib/types";

export interface SearchInput {
  q: string;
  types?: Array<"changes" | "recommendations" | "competitors">;
  limit?: number;
}

export const searchApi = {
  search: ({ q, types, limit }: SearchInput) =>
    apiClient<SearchResponse>("/search", {
      params: {
        q,
        types: types?.join(","),
        limit,
      },
    }),
};
