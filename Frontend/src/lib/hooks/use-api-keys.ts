"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiKeysApi } from "@/lib/api/api-keys";

const KEY = ["api-keys"] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: apiKeysApi.list,
    staleTime: 60_000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiKeysApi.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeysApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
