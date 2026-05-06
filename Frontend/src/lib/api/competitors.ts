import { apiClient } from "./client";
import type { Competitor, CompetitorDetail, PageType } from "@/lib/types";

export interface CreateCompetitorInput {
  name: string;
  url: string;
  pagesToTrack: PageType[];
}

export interface BulkImportResponse {
  imported: number;
  skipped: Array<{ rowNumber: number; reason: string }>;
  competitors: Array<Competitor & { rowNumber: number }>;
}

export const competitorsApi = {
  list: () => apiClient<Competitor[]>("/competitors"),

  get: (id: string) => apiClient<CompetitorDetail>(`/competitors/${id}`),

  create: (data: CreateCompetitorInput) =>
    apiClient<Competitor>("/competitors", {
      method: "POST",
      body: data,
    }),

  bulkImport: (input: { csv: string; skipIneligible?: boolean }) =>
    apiClient<BulkImportResponse>("/competitors/bulk-import", {
      method: "POST",
      body: input,
    }),

  delete: (id: string) =>
    apiClient<{ message: string }>(`/competitors/${id}`, {
      method: "DELETE",
    }),

  research: (id: string) =>
    apiClient<{ message: string }>(`/competitors/${id}/research`, {
      method: "POST",
    }),

  snooze: (id: string, snoozedUntil: string | null) =>
    apiClient<{ id: string; snoozedUntil: string | null; snoozedAt: string | null }>(
      `/competitors/${id}/snooze`,
      {
        method: "PATCH",
        body: { snoozedUntil },
      }
    ),
};
