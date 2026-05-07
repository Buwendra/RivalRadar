"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { savedViewsApi } from "@/lib/api/saved-views";
import type { SavedViewFilters } from "@/lib/types";

const KEY = ["saved-views"] as const;

export function useSavedViews() {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: savedViewsApi.list,
    staleTime: 60_000,
  });
}

export function useCreateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; filters: SavedViewFilters }) =>
      savedViewsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      filters?: SavedViewFilters;
      webhookOnMatch?: boolean;
    }) => savedViewsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => savedViewsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSubscribeSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => savedViewsApi.subscribe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUnsubscribeSavedView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => savedViewsApi.unsubscribe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
