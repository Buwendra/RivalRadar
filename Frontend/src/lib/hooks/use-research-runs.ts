"use client";

import { useQuery } from "@tanstack/react-query";
import { researchRunsApi } from "@/lib/api/research-runs";
import type { ResearchRunStatus, ResearchRunSummary } from "@/lib/types";

const KEY = ["research-runs"] as const;

interface UseResearchRunsFilter {
  competitorId?: string;
  status?: ResearchRunStatus;
}

/**
 * List research runs. Polls every 5s while ANY run is queued or running so
 * the dashboard reflects status transitions quickly. Idle once everything
 * has reached a terminal state.
 */
export function useResearchRuns(filter?: UseResearchRunsFilter) {
  return useQuery({
    queryKey: [...KEY, "list", filter ?? {}],
    queryFn: () => researchRunsApi.list(filter),
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data as ResearchRunSummary[] | undefined;
      const active = data?.some(
        (r) => r.status === "queued" || r.status === "running"
      );
      return active ? 5_000 : false;
    },
  });
}

/** Single-run with full event log. Loaded when a card is expanded. */
export function useResearchRun(id: string | null, enabled = true) {
  return useQuery({
    queryKey: [...KEY, "detail", id],
    queryFn: () => researchRunsApi.get(id!),
    enabled: enabled && !!id,
    staleTime: 5_000,
  });
}

/** Lazy "Technical details" — Step Function history + CloudWatch tail. */
export function useResearchRunTechnical(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "technical", id],
    queryFn: () => researchRunsApi.details(id!),
    enabled: enabled && !!id,
    staleTime: 30_000,
  });
}
