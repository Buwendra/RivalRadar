import { apiClient } from "./client";
import type { Competitor, CompetitorDetail, PageType } from "@/lib/types";

export interface CreateCompetitorInput {
  name: string;
  url: string;
  pagesToTrack: PageType[];
}

export const competitorsApi = {
  list: () => apiClient<Competitor[]>("/competitors"),

  get: (id: string) => apiClient<CompetitorDetail>(`/competitors/${id}`),

  create: (data: CreateCompetitorInput) =>
    apiClient<Competitor>("/competitors", {
      method: "POST",
      body: data,
    }),

  delete: (id: string) =>
    apiClient<{ message: string }>(`/competitors/${id}`, {
      method: "DELETE",
    }),

  scrape: (id: string) =>
    apiClient<{ message: string }>(`/competitors/${id}/scrape`, {
      method: "POST",
    }),
};
