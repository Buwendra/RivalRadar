/**
 * Phase 23 — Brand Pulse. Types for the workspace's self-brand surface.
 * Mirrors the `/brand/*` API shapes. Note: shape is intentionally narrower
 * than CompetitorDetail because threat/predicted-moves don't apply to self.
 */

import type { Citation, ResearchCategory, FindingItem } from "./research";
import type { Momentum } from "./competitor";
import type { AiAnalysis } from "./change";

export interface BrandLatestResearch {
  id: string;
  generatedAt: string;
  summary: string;
  categories: Record<ResearchCategory, FindingItem[]>;
  citations: Citation[];
  searchQueries: string[];
}

export interface BrandCoverageChange {
  id: string;
  significance: number;
  pageUrl: string;
  aiAnalysis: AiAnalysis;
  detectedAt: string;
  sourceCategory?: ResearchCategory;
}

export interface BrandDetail {
  id: string;
  name: string;
  url: string;
  industry?: string;
  momentum: Momentum;
  momentumChangePercent: number;
  momentumAsOf?: string;
  derivedTags: string[];
  derivedTagsAsOf?: string;
  latestResearch: BrandLatestResearch | null;
  changesByDay: Array<{ date: string; count: number }>;
  recentChanges: BrandCoverageChange[];
}

export interface BrandSentimentWeek {
  weekStart: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export interface BrandSentimentResponse {
  weeks: BrandSentimentWeek[];
}

export interface BrandSetupInput {
  companyName: string;
  companyWebsite: string;
  industry?: string;
}

export interface BrandSetupResponse {
  id: string;
  name: string;
  url: string;
  industry?: string;
  runId?: string;
}

/**
 * Phase 24 — Brand Health Score. Composite 0–100 KPI + per-component breakdown.
 */
export type BrandHealthConfidence = "low" | "medium" | "high";

export interface BrandHealthComponent {
  score: number;
  detail: string;
}

export interface BrandHealthScore {
  score: number;
  components: {
    sentiment: BrandHealthComponent;
    voice: BrandHealthComponent;
    momentum: BrandHealthComponent;
  };
  confidence: BrandHealthConfidence;
  asOf: string;
}
