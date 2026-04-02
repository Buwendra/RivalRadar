"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { competitorsApi, type CreateCompetitorInput } from "@/lib/api/competitors";

export function useCompetitors() {
  return useQuery({
    queryKey: ["competitors"],
    queryFn: () => competitorsApi.list(),
    staleTime: 30_000,
  });
}

export function useCreateCompetitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCompetitorInput) => competitorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    },
  });
}

export function useDeleteCompetitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => competitorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["competitors"] });
    },
  });
}

export function useScrapeCompetitor() {
  return useMutation({
    mutationFn: (id: string) => competitorsApi.scrape(id),
  });
}
