import type { ChangeType } from "./change";

export interface SavedViewFilters {
  minSignificance?: number;
  competitorIds?: string[];
  changeTypes?: ChangeType[];
  sinceDays?: number;
}

export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  /** Phase 15 — caller's per-user subscription state for this view. */
  subscribed?: boolean;
  /** Phase 17 — when true, matching changes fire a real-time webhook to the
   *  workspace's webhook integration. Owner/admin-only toggle. */
  webhookOnMatch?: boolean;
}

export interface SearchResult {
  type: "change" | "recommendation" | "competitor";
  id: string;
  title: string;
  snippet: string;
  matchedField: string;
  score: number;
  createdAt: string;
  competitorId?: string;
  competitorName?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalScanned: number;
  truncated: boolean;
}
