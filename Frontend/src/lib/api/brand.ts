/**
 * Phase 23 — Brand Pulse. API client for the workspace's self-brand surface.
 * Mirrors the competitor API module shape so the hook layer feels familiar.
 *
 * The `get()` call has a non-standard return type: when no self-brand row
 * exists yet, the backend returns `{ data: null, meta: { needsSetup: true } }`.
 * We surface that as `BrandDetail | null` so the page can render its setup CTA.
 */

import { apiClient, apiClientWithMeta } from "./client";
import type {
  BrandDetail,
  BrandCoverageChange,
  BrandSentimentResponse,
  BrandSetupInput,
  BrandSetupResponse,
  PaginationMeta,
} from "@/lib/types";

export interface BrandCoverageResponse {
  data: BrandCoverageChange[];
  meta: PaginationMeta;
}

export const brandApi = {
  /**
   * Returns `null` when the workspace hasn't completed brand setup yet
   * (legacy users pre-Phase-23). Caller should render the setup CTA.
   */
  get: async (): Promise<BrandDetail | null> => {
    const res = await apiClientWithMeta<BrandDetail | null>("/brand");
    return (res.data as BrandDetail | null) ?? null;
  },

  triggerResearch: () =>
    apiClient<{ message: string; runId: string }>("/brand/research", { method: "POST" }),

  coverage: async (
    params: { cursor?: string; limit?: number } = {}
  ): Promise<BrandCoverageResponse> => {
    const response = await apiClientWithMeta<BrandCoverageChange[]>("/brand/coverage", {
      params,
    });
    return {
      data: response.data ?? [],
      meta: response.meta ?? { hasMore: false },
    };
  },

  sentiment: () => apiClient<BrandSentimentResponse>("/brand/sentiment"),

  setup: (input: BrandSetupInput) =>
    apiClient<BrandSetupResponse>("/brand/setup", { method: "POST", body: input }),
};
