import { apiClient } from "./client";
import type {
  ResearchRunDetail,
  ResearchRunStatus,
  ResearchRunSummary,
  ResearchRunTechnicalDetails,
} from "@/lib/types";

export const researchRunsApi = {
  list: (filter?: { competitorId?: string; status?: ResearchRunStatus }) =>
    apiClient<ResearchRunSummary[]>("/research-runs", {
      params: {
        ...(filter?.competitorId ? { competitorId: filter.competitorId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
    }),

  get: (id: string) => apiClient<ResearchRunDetail>(`/research-runs/${id}`),

  details: (id: string) =>
    apiClient<ResearchRunTechnicalDetails>(`/research-runs/${id}/details`),
};
