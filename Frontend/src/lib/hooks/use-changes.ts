"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { changesApi } from "@/lib/api/changes";
import type { ChangeFilters } from "@/lib/types";

export function useChanges(filters: ChangeFilters = {}) {
  return useInfiniteQuery({
    queryKey: ["changes", "list", filters],
    queryFn: ({ pageParam }) =>
      changesApi.list({ ...filters, cursor: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.hasMore ? lastPage.meta.cursor : undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 60_000,
  });
}

export function useChangeFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, helpful }: { id: string; helpful: boolean }) =>
      changesApi.feedback(id, helpful),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changes"] });
    },
  });
}
