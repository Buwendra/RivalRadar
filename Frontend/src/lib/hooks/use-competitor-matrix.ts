"use client";

import { useQuery } from "@tanstack/react-query";
import { matrixApi } from "@/lib/api/competitors-matrix";

const KEY = ["competitor-matrix"] as const;

export function useCompetitorMatrix(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...KEY, "list"],
    queryFn: matrixApi.list,
    staleTime: 60_000,
    enabled: options.enabled ?? true,
  });
}
