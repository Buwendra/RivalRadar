"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { battlecardsApi } from "@/lib/api/battlecards";

const KEY = ["battlecards"] as const;

export function useBattlecards(competitorId?: string) {
  return useQuery({
    queryKey: [...KEY, "list", competitorId ?? "all"],
    queryFn: () => battlecardsApi.list({ competitorId }),
    staleTime: 30_000,
  });
}

export function useGenerateBattlecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitorId: string) => battlecardsApi.generate(competitorId),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeBattlecard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => battlecardsApi.revoke(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
