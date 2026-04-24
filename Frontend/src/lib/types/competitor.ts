export type PageType = "pricing" | "features" | "homepage" | "blog" | "careers";

export interface Competitor {
  id: string;
  name: string;
  url: string;
  pagesToTrack: PageType[];
  status: "active" | "paused";
  createdAt: string;
}

export interface CompetitorDetailChange {
  id: string;
  significance: number;
  pageUrl?: string;
  aiAnalysis: AiAnalysis;
  detectedAt: string;
  researchId?: string;
  sourceCategory?: ResearchCategory;
}

export interface CompetitorStats {
  changes7d: number;
  changes30d: number;
  highSignificance30d: number;
  lastChangeAt: string | null;
  lastResearchAt: string | null;
  changesByPage: Partial<Record<PageType, number>>;
  changesByType: Partial<Record<ChangeType, number>>;
  changesByDay: Array<{ date: string; count: number }>;
}

export interface CompetitorDetail extends Competitor {
  recentChanges: CompetitorDetailChange[];
  recentResearch: ResearchFinding[];
  stats: CompetitorStats;
}

import type { AiAnalysis, ChangeType } from "./change";
import type { ResearchFinding, ResearchCategory } from "./research";
