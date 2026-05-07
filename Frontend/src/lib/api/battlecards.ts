import { apiClient } from "./client";
import type { BattlecardSummary } from "@/lib/types";

export const battlecardsApi = {
  generate: (competitorId: string) =>
    apiClient<BattlecardSummary>(`/competitors/${competitorId}/battlecard`, {
      method: "POST",
      body: {},
    }),

  list: (filter?: { competitorId?: string }) =>
    apiClient<BattlecardSummary[]>("/battlecards", {
      params: filter?.competitorId ? { competitorId: filter.competitorId } : undefined,
    }),

  revoke: (id: string) =>
    apiClient<{ id: string; revokedAt: string; alreadyRevoked?: boolean }>(
      `/battlecards/${id}`,
      { method: "DELETE" }
    ),
};
