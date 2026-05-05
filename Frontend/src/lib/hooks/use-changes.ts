"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

export function useChangeNotes(changeId: string | undefined) {
  return useQuery({
    queryKey: ["changes", changeId, "notes"],
    queryFn: () => changesApi.listNotes(changeId!),
    enabled: !!changeId,
    staleTime: 30_000,
  });
}

export function useCreateChangeNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ changeId, body }: { changeId: string; body: string }) =>
      changesApi.createNote(changeId, body),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["changes", vars.changeId, "notes"] });
    },
  });
}
