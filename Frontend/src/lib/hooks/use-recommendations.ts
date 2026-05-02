"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { recommendationsApi, type RecommendationFilters } from "@/lib/api/recommendations";
import type { RecommendationStatus } from "@/lib/types";

export function useRecommendations(filters: RecommendationFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["recommendations", "list", filters],
    queryFn: ({ pageParam }) =>
      recommendationsApi.list({ ...filters, cursor: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 60_000,
  });
}

export function useUpdateRecommendationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: RecommendationStatus;
    }) => recommendationsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
}
