"use client";

/**
 * Phase 23 — Brand Pulse. TanStack Query hooks for the self-brand surface.
 * Mirrors `use-competitors.ts` (90s research invalidation delay so the freshly
 * written finding is visible on refetch).
 */

import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { brandApi, type BrandCoverageResponse } from "@/lib/api/brand";
import type { BrandSetupInput } from "@/lib/types";

export function useBrand() {
  return useQuery({
    queryKey: ["brand"],
    queryFn: () => brandApi.get(),
    staleTime: 30_000,
  });
}

export function useTriggerBrandResearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => brandApi.triggerResearch(),
    onSuccess: () => {
      // Mirror useTriggerResearch — refresh after the pipeline likely completes.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["brand"] });
        queryClient.invalidateQueries({ queryKey: ["brand", "coverage"] });
        queryClient.invalidateQueries({ queryKey: ["brand", "sentiment"] });
      }, 90_000);
    },
  });
}

export function useBrandCoverage() {
  return useInfiniteQuery<BrandCoverageResponse, Error>({
    queryKey: ["brand", "coverage"],
    queryFn: ({ pageParam }) =>
      brandApi.coverage({ cursor: pageParam as string | undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.cursor : undefined),
    staleTime: 30_000,
  });
}

export function useBrandSentiment() {
  return useQuery({
    queryKey: ["brand", "sentiment"],
    queryFn: () => brandApi.sentiment(),
    staleTime: 60_000,
  });
}

export function useBrandSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BrandSetupInput) => brandApi.setup(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand"] });
    },
  });
}
